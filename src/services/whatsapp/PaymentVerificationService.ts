/**
 * Payment Verification Service
 * Handles payment proof verification using OCR and AI
 */

// Baileys-compatible media interface
interface MediaMessage {
    data: string | Buffer; // base64 string or Buffer
    mimetype?: string;
    filename?: string;
}

import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

import { OCRService } from '../payment/OCRService';
import { GeminiService } from '../payment/GeminiService';

export interface VerificationResult {
    success: boolean;
    error?: string;
    invoiceNumber?: string;
    invoiceStatus?: string;
    amount?: number;
    confidence?: number;
}

export class PaymentVerificationService {
    /**
     * Verify payment proof automatically - AI will analyze and match
     */
    static async verifyPaymentProofAuto(
        media: MediaMessage,
        customerId: number
    ): Promise<VerificationResult> {
        try {
            console.log(`[PaymentVerification] Auto-verifying payment proof for customer ${customerId}`);

            // 1. Extract data from image using AI/OCR
            const extractedData = await this.extractPaymentData(media);

            if (!extractedData.success || !extractedData.amount) {
                return {
                    success: false,
                    error: extractedData.error || 'Gagal membaca jumlah transfer dari bukti transfer. Pastikan foto jelas.'
                };
            }

            const transferAmount = extractedData.amount;

            // 2. Match with pending payments (Postpaid only)
            return await this.verifyPostpaidPayment(customerId, media, transferAmount, extractedData);

        } catch (error: any) {
            console.error('[PaymentVerification] Error:', error);
            return {
                success: false,
                error: error.message || 'Terjadi kesalahan saat verifikasi'
            };
        }
    }



    /**
     * Verify postpaid payment (invoice payment)
     */
    private static async verifyPostpaidPayment(
        customerId: number,
        media: MediaMessage,
        transferAmount: number,
        extractedData: any
    ): Promise<VerificationResult> {
        try {
            // Find unpaid invoices
            const [invoices] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM invoices
                 WHERE customer_id = ?
                 AND status IN ('sent', 'partial', 'overdue')
                 AND remaining_amount > 0
                 ORDER BY due_date ASC, created_at DESC`,
                [customerId]
            );

            if (invoices.length === 0) {
                return {
                    success: false,
                    error: 'Tidak ada tagihan yang belum dibayar. Semua tagihan Anda sudah lunas.'
                };
            }

            // Match by amount (find closest match)
            let bestMatch: any = null;
            let minDiff = Infinity;

            for (const invoice of invoices) {
                const remaining = parseFloat(invoice.remaining_amount.toString());
                const diff = Math.abs(transferAmount - remaining);

                // Check if amount matches remaining or total
                if (diff <= 1000) { // Allow 1000 rupiah tolerance
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestMatch = invoice;
                    }
                } else {
                    // Check if matches total amount
                    const total = parseFloat(invoice.total_amount.toString());
                    const totalDiff = Math.abs(transferAmount - total);
                    if (totalDiff <= 1000 && totalDiff < minDiff) {
                        minDiff = totalDiff;
                        bestMatch = invoice;
                    }
                }
            }

            if (!bestMatch) {
                const invoiceList = invoices.map((inv: any) =>
                    `• ${inv.invoice_number}: Rp ${parseFloat(inv.remaining_amount.toString()).toLocaleString('id-ID')}`
                ).join('\n');

                return {
                    success: false,
                    error: `Jumlah transfer tidak sesuai dengan tagihan yang belum dibayar.\n\nJumlah yang ditemukan: Rp ${transferAmount.toLocaleString('id-ID')}\n\nTagihan yang belum dibayar:\n${invoiceList}`
                };
            }

            // Verify with AI
            const imageBuffer = typeof media.data === 'string'
                ? Buffer.from(media.data, 'base64')
                : media.data;
            const geminiEnabled = await GeminiService.isEnabled();

            if (geminiEnabled) {
                const expectedAmount = parseFloat(bestMatch.remaining_amount.toString());
                const geminiResult = await GeminiService.analyzePaymentProof(
                    imageBuffer,
                    expectedAmount,
                    undefined,
                    'invoice'
                );

                if (!geminiResult.isValid || geminiResult.confidence < 0.6) {
                    return {
                        success: false,
                        error: 'Verifikasi AI gagal. Bukti transfer tidak valid atau tidak jelas.'
                    };
                }
            }

            // Record payment
            const remainingAmount = parseFloat(bestMatch.remaining_amount.toString());
            const paymentAmount = Math.min(transferAmount, remainingAmount);
            const isFullPayment = paymentAmount >= remainingAmount;

            await this.recordInvoicePayment(
                bestMatch.id,
                customerId,
                paymentAmount,
                'transfer',
                `Verifikasi otomatis via WhatsApp - ${extractedData.bankAccount || 'Unknown'}`,
                extractedData.transferDate || new Date()
            );

            // Save payment verification record
            await this.saveInvoicePaymentVerification(
                customerId,
                bestMatch.id,
                transferAmount,
                extractedData.bankAccount || 'Unknown',
                extractedData.transferDate || new Date()
            );

            return {
                success: true,
                invoiceNumber: bestMatch.invoice_number,
                invoiceStatus: isFullPayment ? 'Lunas' : 'Sebagian',
                amount: paymentAmount,
                confidence: 0.85
            };

        } catch (error: any) {
            console.error('[PaymentVerification] Error verifying postpaid:', error);
            return {
                success: false,
                error: error.message || 'Gagal memverifikasi pembayaran postpaid'
            };
        }
    }

    /**
     * Record invoice payment
     */
    private static async recordInvoicePayment(
        invoiceId: number,
        customerId: number,
        amount: number,
        paymentMethod: string,
        notes: string,
        paymentDate: Date
    ): Promise<void> {
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            // Get invoice
            const [invoices] = await connection.query<RowDataPacket[]>(
                'SELECT * FROM invoices WHERE id = ?',
                [invoiceId]
            );

            if (invoices.length === 0) {
                throw new Error('Invoice tidak ditemukan');
            }

            const invoice = invoices[0]!;
            const currentPaid = parseFloat(invoice.paid_amount?.toString() || '0');
            const totalAmount = parseFloat(invoice.total_amount.toString());
            const newPaid = currentPaid + amount;
            const newRemaining = totalAmount - newPaid;

            // Insert payment record
            await connection.query(
                `INSERT INTO payments (invoice_id, payment_method, amount, payment_date, notes, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [invoiceId, paymentMethod, amount, paymentDate, notes]
            );

            // Update invoice
            let newStatus = invoice.status;
            if (newRemaining <= 0) {
                newStatus = 'paid';
            } else if (newPaid > 0) {
                newStatus = 'partial';
            }

            await connection.query(
                `UPDATE invoices 
                 SET paid_amount = ?, remaining_amount = ?, status = ?, 
                     last_payment_date = ?, paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END,
                     updated_at = NOW()
                 WHERE id = ?`,
                [newPaid, newRemaining, newStatus, paymentDate, newStatus, invoiceId]
            );

            // Remove isolation if paid
            if (newStatus === 'paid') {
                await connection.query(
                    'UPDATE customers SET is_isolated = FALSE WHERE id = ?',
                    [customerId]
                );
            }

            await connection.commit();

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Save invoice payment verification record
     */
    private static async saveInvoicePaymentVerification(
        customerId: number,
        invoiceId: number,
        amount: number,
        bankAccount: string,
        transferDate: Date
    ): Promise<void> {
        try {
            await databasePool.query(
                `INSERT INTO payment_verifications 
                 (customer_id, invoice_id, purchase_code, amount, bank_account, transfer_date, status, verified_at, created_at)
                 VALUES (?, ?, NULL, ?, ?, ?, 'verified', NOW(), NOW())`,
                [customerId, invoiceId, amount, bankAccount, transferDate]
            );

            console.log(`[PaymentVerification] Invoice payment verification saved for invoice ${invoiceId}`);

        } catch (error: any) {
            console.error('[PaymentVerification] Error saving invoice verification:', error);
            // Don't throw, payment is already processed
        }
    }



    /**
     * Extract payment data from image using OCR/AI
     */
    private static async extractPaymentData(media: MediaMessage): Promise<{
        success: boolean;
        amount?: number;
        invoiceNumber?: string;
        bankAccount?: string;
        transferDate?: Date;
        error?: string;
    }> {
        try {
            // Convert base64 to buffer
            const imageBuffer = typeof media.data === 'string'
                ? Buffer.from(media.data, 'base64')
                : media.data;

            // Try Gemini AI first (more accurate)
            const geminiEnabled = await GeminiService.isEnabled();
            if (geminiEnabled) {
                try {
                    console.log('[PaymentVerification] Using Gemini AI for extraction...');
                    const geminiResult = await GeminiService.analyzePaymentProof(
                        imageBuffer,
                        undefined, // expectedAmount - will verify later
                        undefined, // expectedBank
                        'invoice' // transactionType
                    );

                    if (geminiResult.isValid && geminiResult.extractedData) {
                        const extracted = geminiResult.extractedData;

                        return {
                            success: true,
                            invoiceNumber: extracted.referenceNumber,
                            amount: extracted.amount || undefined,
                            bankAccount: extracted.accountNumber || extracted.bank || undefined,
                            transferDate: extracted.date ? new Date(extracted.date) : new Date()
                        };
                    }
                } catch (geminiError: any) {
                    console.warn('[PaymentVerification] Gemini extraction failed, falling back to OCR:', geminiError.message);
                }
            }

            // Fallback to OCR
            console.log('[PaymentVerification] Using OCR for extraction...');
            const ocrResult = await OCRService.extractPaymentData(imageBuffer);

            return {
                success: true,
                amount: ocrResult.amount || undefined,
                bankAccount: ocrResult.accountNumber || ocrResult.bank || undefined,
                transferDate: ocrResult.date ? new Date(ocrResult.date) : new Date()
            };

        } catch (error: any) {
            console.error('[PaymentVerification] Error extracting data:', error);
            return {
                success: false,
                error: 'Gagal membaca bukti transfer. Pastikan foto jelas dan tidak blur.'
            };
        }
    }



}

