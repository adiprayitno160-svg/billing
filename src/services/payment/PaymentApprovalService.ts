/**
 * Payment Approval Service
 * Handles auto-approval and manual review workflow
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { MachineLearningService } from '../billing/machineLearningService';
import { ExtractedPaymentData } from './OCRService';
import { MatchingResult } from './InvoiceMatchingService';
import { GeminiService } from './GeminiService';
import path from 'path';
import fs from 'fs/promises';

export interface ApprovalDecision {
    action: 'auto_approve' | 'manual_review' | 'priority_review';
    confidence: number;
    fraudScore: number;
    reasons: string[];
    invoiceId?: number;
    amount?: number;
}

export interface PaymentVerificationRecord {
    id?: number;
    customer_id: number;
    invoice_id?: number;
    amount: number;
    payment_proof_url: string;
    extracted_data?: any;
    matching_result?: any;
    fraud_score?: number;
    confidence_score?: number;
    status: 'pending' | 'approved' | 'rejected';
    verification_notes?: string;
    verified_by?: number;
    verified_at?: Date;
}

export class PaymentApprovalService {
    /**
     * Process payment proof and make approval decision
     * Now uses Gemini AI for enhanced analysis
     */
    static async processPaymentProof(
        customerId: number,
        imageBuffer: Buffer,
        proofUrl: string,
        extractedData: ExtractedPaymentData,
        matchingResult: MatchingResult,
        expectedAmount?: number,
        expectedBank?: string
    ): Promise<ApprovalDecision & { verificationId?: number }> {
        try {
            console.log('🔍 Processing payment approval with Gemini AI...');

            // Use Gemini AI for analysis
            let geminiAnalysis = null;
            let geminiAutoApprove = false;
            let geminiConfidence = 0;

            try {
                geminiAnalysis = await GeminiService.analyzePaymentProof(
                    imageBuffer,
                    expectedAmount || extractedData.amount,
                    expectedBank || extractedData.bank
                );

                const geminiDecision = await GeminiService.shouldAutoApprove(geminiAnalysis);
                geminiAutoApprove = geminiDecision.shouldApprove;
                geminiConfidence = geminiDecision.confidence;

                console.log(`🤖 Gemini Analysis: Valid=${geminiAnalysis.isValid}, Risk=${geminiAnalysis.validation.riskLevel}, AutoApprove=${geminiAutoApprove}`);

                // If Gemini says it's valid and should auto-approve, use Gemini data
                if (geminiAutoApprove && geminiAnalysis.isValid) {
                    // Update extractedData with Gemini results if more accurate
                    if (geminiAnalysis.extractedData.amount && !extractedData.amount) {
                        extractedData.amount = geminiAnalysis.extractedData.amount;
                    }
                    if (geminiAnalysis.extractedData.date && !extractedData.date) {
                        extractedData.date = new Date(geminiAnalysis.extractedData.date);
                    }
                    if (geminiAnalysis.extractedData.bank && !extractedData.bank) {
                        extractedData.bank = geminiAnalysis.extractedData.bank;
                    }
                }
            } catch (geminiError) {
                console.warn('⚠️ Gemini analysis failed, falling back to traditional method:', geminiError);
                // Continue with traditional method
            }

            // Calculate fraud score (traditional method as fallback)
            const fraudData = {
                customer_id: customerId,
                amount: extractedData.amount || 0,
                date: extractedData.date || new Date(),
                matching_confidence: matchingResult.confidence,
                ...extractedData
            };

            const fraudResult = await MachineLearningService.detectFraud(fraudData);
            let fraudScore = fraudResult.confidence;

            // Adjust fraud score based on Gemini analysis
            if (geminiAnalysis) {
                if (geminiAnalysis.validation.riskLevel === 'low') {
                    fraudScore = Math.max(0, fraudScore - 20); // Reduce fraud score
                } else if (geminiAnalysis.validation.riskLevel === 'high') {
                    fraudScore = Math.min(100, fraudScore + 30); // Increase fraud score
                }
            }

            // Calculate overall confidence score
            let confidenceScore = this.calculateConfidenceScore(
                extractedData.confidence,
                matchingResult.confidence,
                fraudScore
            );

            // Boost confidence if Gemini approves
            if (geminiAutoApprove && geminiConfidence > 0) {
                confidenceScore = Math.min(100, (confidenceScore + geminiConfidence) / 2);
            }

            // Make decision (prioritize Gemini if available)
            let decision: ApprovalDecision;
            if (geminiAutoApprove && geminiAnalysis && geminiAnalysis.isValid) {
                // Auto-approve based on Gemini
                decision = {
                    action: 'auto_approve',
                    confidence: geminiConfidence,
                    fraudScore: geminiAnalysis.validation.riskLevel === 'low' ? 10 : 25,
                    reasons: [
                        'Gemini AI: Bukti transfer valid',
                        `Tingkat risiko: ${geminiAnalysis.validation.riskLevel}`,
                        ...geminiDecision.reasons
                    ],
                    invoiceId: matchingResult.bestMatch?.invoice_id,
                    amount: geminiAnalysis.extractedData.amount || extractedData.amount
                };
            } else {
                // Use traditional decision making
                decision = this.makeDecision(confidenceScore, fraudScore, matchingResult);

                // Add Gemini insights if available
                if (geminiAnalysis) {
                    if (!geminiAnalysis.isValid) {
                        decision.reasons.push('Gemini: Bukti transfer tidak valid');
                    }
                    if (geminiAnalysis.validation.riskLevel === 'high') {
                        decision.action = 'priority_review';
                        decision.reasons.push('Gemini: Tingkat risiko tinggi terdeteksi');
                    }
                }
            }

            // Save verification record
            const verificationId = await this.saveVerificationRecord({
                customer_id: customerId,
                invoice_id: decision.invoiceId,
                amount: extractedData.amount || 0,
                payment_proof_url: proofUrl,
                extracted_data: extractedData,
                matching_result: matchingResult,
                fraud_score: fraudScore,
                confidence_score: confidenceScore,
                status: decision.action === 'auto_approve' ? 'approved' : 'pending'
            });

            return {
                ...decision,
                verificationId
            };

        } catch (error) {
            console.error('Error processing payment proof:', error);
            throw error;
        }
    }

    /**
     * Calculate overall confidence score
     */
    private static calculateConfidenceScore(
        ocrConfidence: number,
        matchingConfidence: number,
        fraudScore: number
    ): number {
        // Weighted average
        const ocrWeight = 0.3;
        const matchingWeight = 0.5;
        const fraudWeight = 0.2;

        // Fraud score is inverted (higher fraud = lower confidence)
        const fraudConfidence = 100 - fraudScore;

        const totalConfidence = (
            (ocrConfidence * ocrWeight) +
            (matchingConfidence * matchingWeight) +
            (fraudConfidence * fraudWeight)
        );

        return Math.round(totalConfidence);
    }

    /**
     * Make approval decision based on confidence and fraud score
     */
    private static makeDecision(
        confidenceScore: number,
        fraudScore: number,
        matchingResult: MatchingResult
    ): ApprovalDecision {
        const reasons: string[] = [];
        let action: 'auto_approve' | 'manual_review' | 'priority_review';
        let invoiceId: number | undefined;

        // Decision matrix (based on user requirements)
        if (fraudScore <= 25) {
            // Low fraud, high confidence
            if (confidenceScore >= 75 && matchingResult.matched) {
                action = 'auto_approve';
                invoiceId = matchingResult.bestMatch?.invoice_id;
                reasons.push('Fraud score rendah');
                reasons.push('Confidence score tinggi');
                reasons.push('Invoice matched dengan baik');
            } else {
                action = 'auto_approve';
                if (matchingResult.bestMatch) {
                    invoiceId = matchingResult.bestMatch.invoice_id;
                    reasons.push('Fraud score rendah - auto approve');
                } else {
                    reasons.push('Fraud score rendah tapi invoice tidak match');
                }
            }
        } else if (fraudScore <= 40) {
            // Medium fraud, medium confidence
            if (confidenceScore >= 60 && matchingResult.matched) {
                action = 'auto_approve';
                invoiceId = matchingResult.bestMatch?.invoice_id;
                reasons.push('Fraud score sedang tapi masih dapat auto approve');
                reasons.push('Invoice match terdeteksi');
            } else {
                action = 'manual_review';
                if (matchingResult.bestMatch) {
                    invoiceId = matchingResult.bestMatch.invoice_id;
                }
                reasons.push('Fraud score sedang memerlukan review');
            }
        } else if (fraudScore <= 60) {
            // Higher fraud
            action = 'manual_review';
            if (matchingResult.bestMatch) {
                invoiceId = matchingResult.bestMatch.invoice_id;
            }
            reasons.push('Fraud score tinggi - perlu manual review');
            reasons.push('Verifikasi ekstensif diperlukan');
        } else {
            // Very high fraud
            action = 'priority_review';
            if (matchingResult.bestMatch) {
                invoiceId = matchingResult.bestMatch.invoice_id;
            }
            reasons.push('Fraud score sangat tinggi - priority review');
            reasons.push('Peringatan: High risk payment');
        }

        return {
            action,
            confidence: confidenceScore,
            fraudScore,
            reasons,
            invoiceId,
            amount: matchingResult.bestMatch?.amount
        };
    }

    /**
     * Auto-approve payment
     */
    static async autoApprovePayment(
        verificationId: number,
        invoiceId: number,
        amount: number,
        customerId: number
    ): Promise<void> {
        const connection = await databasePool.getConnection();
        try {
            await connection.beginTransaction();

            // Record payment
            const paymentQuery = `
                INSERT INTO payments (
                    invoice_id, payment_method, amount, reference_number, 
                    gateway_status, created_at, payment_date
                ) VALUES (?, 'transfer', ?, ?, 'paid', NOW(), NOW())
            `;

            const [paymentResult] = await connection.execute<ResultSetHeader>(
                paymentQuery,
                [invoiceId, amount, `WA-${Date.now()}`]
            );

            const paymentId = paymentResult.insertId;

            // Update invoice payment status
            await connection.execute(`
                UPDATE invoices 
                SET paid_amount = paid_amount + ?,
                    remaining_amount = remaining_amount - ?,
                    status = CASE 
                        WHEN remaining_amount - ? <= 0 THEN 'paid'
                        ELSE 'partial'
                    END
                WHERE id = ?
            `, [amount, amount, amount, invoiceId]);

            // Update verification record (if table exists)
            try {
                await connection.execute(`
                    UPDATE payment_verifications
                    SET status = 'approved',
                        verified_at = NOW()
                    WHERE id = ?
                `, [verificationId]);
            } catch (e) {
                // Table might not exist, continue
                console.warn('Could not update payment_verifications:', e);
            }

            // Save payment proof link
            try {
                const [verification] = await connection.execute<RowDataPacket[]>(
                    'SELECT payment_proof_url FROM payment_verifications WHERE id = ?',
                    [verificationId]
                );

                if (verification && verification.length > 0 && verification[0].payment_proof_url) {
                    // Try to get proof URL from verification record
                    const proofUrl = verification[0].payment_proof_url;

                    // Insert into payment_proofs table
                    try {
                        await connection.execute(`
                            INSERT INTO payment_proofs (
                                invoice_id, payment_id, proof_type, proof_file_path, 
                                proof_description, created_at
                            ) VALUES (?, ?, 'transfer', ?, 'Bukti transfer', NOW())
                        `, [
                            invoiceId,
                            paymentId,
                            proofUrl
                        ]);
                    } catch (e: any) {
                        // payment_proofs table might have different schema
                        if (e.code !== 'ER_BAD_FIELD_ERROR') {
                            console.warn('Could not save payment proof:', e);
                        }
                    }
                }
            } catch (e) {
                console.warn('Could not retrieve payment proof URL:', e);
            }

            await connection.commit();
            console.log(`✅ Payment auto-approved: Invoice ${invoiceId}, Amount ${amount}`);

        } catch (error) {
            await connection.rollback();
            console.error('Error auto-approving payment:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Save verification record
     */
    private static async saveVerificationRecord(record: PaymentVerificationRecord): Promise<number> {
        try {
            // Check if payment_verifications table exists, if not create it
            // For now, we'll use a simple insert and handle errors
            const query = `
                INSERT INTO payment_verifications (
                    customer_id, invoice_id, amount, payment_proof_url,
                    extracted_data, matching_result, fraud_score, confidence_score,
                    status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            const [result] = await databasePool.execute<ResultSetHeader>(query, [
                record.customer_id,
                record.invoice_id || null,
                record.amount,
                record.payment_proof_url,
                JSON.stringify(record.extracted_data || {}),
                JSON.stringify(record.matching_result || {}),
                record.fraud_score || 0,
                record.confidence_score || 0,
                record.status
            ]);

            return result.insertId;
        } catch (error: any) {
            // If table doesn't exist, log and continue
            if (error.code === 'ER_NO_SUCH_TABLE') {
                console.warn('payment_verifications table not found. Creating...');
                await this.createVerificationTable();
                // Retry
                return this.saveVerificationRecord(record);
            }
            throw error;
        }
    }

    /**
     * Create payment_verifications table if not exists
     */
    private static async createVerificationTable(): Promise<void> {
        const query = `
            CREATE TABLE IF NOT EXISTS payment_verifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                invoice_id INT,
                amount DECIMAL(15,2) NOT NULL,
                payment_proof_url VARCHAR(500) NOT NULL,
                extracted_data JSON,
                matching_result JSON,
                fraud_score DECIMAL(5,2) DEFAULT 0,
                confidence_score DECIMAL(5,2) DEFAULT 0,
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                verification_notes TEXT,
                verified_by INT,
                verified_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_customer (customer_id),
                INDEX idx_status (status),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `;

        await databasePool.execute(query);
        console.log('✅ payment_verifications table created');
    }
}
