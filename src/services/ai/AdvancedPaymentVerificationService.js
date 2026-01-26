"use strict";
/**
 * Advanced AI Payment Verification Service
 * Enhanced with smart detection, multi-stage verification, and auto-approve logic
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedPaymentVerificationService = void 0;
const pool_1 = require("../../db/pool");
const GeminiService_1 = require("../payment/GeminiService");
const AISettingsService_1 = require("../payment/AISettingsService");
class AdvancedPaymentVerificationService {
    /**
     * Main entry point - Smart payment verification with multi-stage processing
     */
    static async verifyPaymentAdvanced(imageBuffer, customerId, options) {
        const startTime = Date.now();
        console.log(`[AdvancedAI] 🚀 Starting advanced verification for customer ${customerId}`);
        try {
            // Stage 1: Extract data from image
            console.log('[AdvancedAI] Stage 1: Extracting payment data...');
            const extractionResult = await this.stageExtraction(imageBuffer, customerId);
            if (!extractionResult.passed) {
                return {
                    success: false,
                    stage: 'extraction',
                    error: 'Gagal mengekstrak data dari bukti transfer. Pastikan foto jelas.',
                    data: {
                        confidence: extractionResult.confidence,
                        riskLevel: 'high',
                        riskScore: 80,
                        fraudIndicators: [],
                        isPaymentProof: extractionResult.details?.isPaymentProof
                    }
                };
            }
            // Stage 2: Match with invoices
            console.log('[AdvancedAI] Stage 2: Matching with invoices...');
            const matchResult = await this.stageMatching(customerId, extractionResult.details.amount, options?.invoiceId);
            if (!matchResult.passed && !options?.bypassAmountCheck) {
                return {
                    success: false,
                    stage: 'matching',
                    error: matchResult.details.error || 'Tidak dapat menemukan tagihan yang sesuai.',
                    data: {
                        extractedAmount: extractionResult.details.amount,
                        confidence: matchResult.confidence,
                        riskLevel: 'medium',
                        riskScore: 50,
                        fraudIndicators: []
                    }
                };
            }
            // Stage 3: Validate payment proof
            console.log('[AdvancedAI] Stage 3: Validating payment proof...');
            const validationResult = await this.stageValidation(imageBuffer, matchResult.details.invoice, extractionResult.details);
            // NEW: Anti-Fraud Stage - Reference Number & Date Verification
            console.log('[AdvancedAI] Anti-Fraud Stage: Checking reference & time...');
            const refNumber = validationResult.details?.referenceNumber || extractionResult.details?.referenceNumber;
            const isDuplicate = refNumber ? await this.checkReferenceNumber(refNumber) : false;
            const isTimeValid = await this.verifyDateTime(validationResult.details?.date, validationResult.details?.time);
            if (isDuplicate) {
                return {
                    success: false,
                    stage: 'validation',
                    error: `❌ FRAUD DETECTED: Nomor referensi ${refNumber} sudah pernah digunakan sebelumnya!`,
                    data: {
                        confidence: 100,
                        riskLevel: 'critical',
                        riskScore: 100,
                        fraudIndicators: [{ type: 'duplicate', severity: 'critical', description: 'Nomor referensi duplikat' }]
                    }
                };
            }
            if (!isTimeValid) {
                validationResult.warnings.push('Waktu transfer tidak valid atau sudah terlalu lama');
            }
            // Stage 4: Determine approval
            console.log('[AdvancedAI] Stage 4: Determining approval...');
            const approvalResult = await this.stageApproval(validationResult, matchResult.details, extractionResult.details, options?.forceManualReview || false);
            // Stage 5: Execute actions if auto-approved
            let actions = {
                paymentRecorded: false,
                isolationRemoved: false,
                notificationSent: false
            };
            if (approvalResult.autoApprove) {
                console.log('[AdvancedAI] Stage 5: Executing auto-approve actions...');
                actions = await this.executeAutoApproveActions(customerId, matchResult.details.invoice, extractionResult.details.amount, validationResult.details);
            }
            const elapsed = Date.now() - startTime;
            console.log(`[AdvancedAI] ✅ Verification complete in ${elapsed}ms`);
            return {
                success: approvalResult.autoApprove,
                stage: approvalResult.autoApprove ? 'complete' : 'approval',
                data: {
                    invoiceId: matchResult.details.invoice?.id,
                    invoiceNumber: matchResult.details.invoice?.invoice_number,
                    customerId: customerId,
                    expectedAmount: matchResult.details.invoice?.remaining_amount,
                    extractedAmount: extractionResult.details.amount,
                    amountMatch: matchResult.details.matchType,
                    confidence: approvalResult.confidence,
                    riskLevel: validationResult.details.riskLevel,
                    riskScore: validationResult.details.riskScore,
                    autoApproved: approvalResult.autoApprove,
                    isPaymentProof: validationResult.details?.isPaymentProof ?? extractionResult.details?.isPaymentProof,
                    referenceNumber: refNumber,
                    date: validationResult.details?.date || extractionResult.details?.date,
                    time: validationResult.details?.time || extractionResult.details?.time,
                    bank: validationResult.details?.bank || extractionResult.details?.bank,
                    fraudIndicators: validationResult.details.fraudIndicators || [],
                    reasoning: approvalResult.reasoning
                },
                actions
            };
        }
        catch (error) {
            console.error('[AdvancedAI] ❌ Verification error:', error);
            // Log failed verification
            await this.logVerificationAttempt(customerId, 'failed', error.message);
            return {
                success: false,
                stage: 'extraction',
                error: error.message || 'Terjadi kesalahan dalam verifikasi',
                data: {
                    confidence: 0,
                    riskLevel: 'high',
                    riskScore: 100,
                    fraudIndicators: []
                }
            };
        }
    }
    /**
     * Stage 1: Extract payment data from image
     */
    static async stageExtraction(imageBuffer, customerId) {
        try {
            const geminiEnabled = await GeminiService_1.GeminiService.isEnabled();
            if (!geminiEnabled) {
                // Fallback to basic OCR if Gemini disabled
                const { OCRService } = await Promise.resolve().then(() => __importStar(require('../payment/OCRService')));
                const ocrResult = await OCRService.extractPaymentData(imageBuffer);
                if (!ocrResult.amount) {
                    return {
                        passed: false,
                        confidence: 20,
                        details: { source: 'ocr', error: 'Tidak dapat membaca nominal' },
                        warnings: ['AI tidak aktif, menggunakan OCR dasar']
                    };
                }
                return {
                    passed: true,
                    confidence: 60,
                    details: {
                        source: 'ocr',
                        amount: ocrResult.amount,
                        bank: ocrResult.bank,
                        accountNumber: ocrResult.accountNumber,
                        date: ocrResult.date,
                        isPaymentProof: true // Assume true if OCR extracted amount
                    },
                    warnings: ['Hasil OCR dasar, akurasi mungkin terbatas']
                };
            }
            // Use Gemini for extraction
            const geminiResult = await GeminiService_1.GeminiService.analyzePaymentProof(imageBuffer, undefined, undefined);
            if (!geminiResult.extractedData.amount) {
                // Try enhanced extraction with different prompt
                const enhancedResult = await this.enhancedAmountExtraction(imageBuffer);
                if (enhancedResult) {
                    return {
                        passed: true,
                        confidence: 70,
                        details: {
                            source: 'gemini_enhanced',
                            amount: enhancedResult.amount,
                            bank: enhancedResult.bank,
                            referenceNumber: enhancedResult.referenceNumber
                        },
                        warnings: ['Menggunakan ekstraksi enhanced']
                    };
                }
                // Fallback to OCR if both Gemini approaches fail
                console.log('[AdvancedAI] Gemini failed to extract amount, falling back to OCR...');
                try {
                    const { OCRService } = await Promise.resolve().then(() => __importStar(require('../payment/OCRService')));
                    const ocrResult = await OCRService.extractPaymentData(imageBuffer);
                    if (ocrResult.amount) {
                        return {
                            passed: true,
                            confidence: 50, // Lower confidence for fallback
                            details: {
                                source: 'ocr_fallback',
                                amount: ocrResult.amount,
                                bank: ocrResult.bank,
                                accountNumber: ocrResult.accountNumber,
                                date: ocrResult.date,
                                isPaymentProof: true
                            },
                            warnings: ['AI gagal ekstraksi, menggunakan fallback OCR']
                        };
                    }
                }
                catch (ocrErr) {
                    console.error('[AdvancedAI] OCR Fallback failed:', ocrErr);
                }
                return {
                    passed: false,
                    confidence: geminiResult.confidence,
                    details: {
                        source: 'gemini',
                        error: 'Nominal tidak terdeteksi (AI & OCR)',
                        rawData: geminiResult.extractedData
                    },
                    warnings: []
                };
            }
            return {
                passed: true,
                confidence: geminiResult.confidence,
                details: {
                    source: 'gemini',
                    amount: geminiResult.extractedData.amount,
                    bank: geminiResult.extractedData.bank,
                    accountNumber: geminiResult.extractedData.accountNumber,
                    accountHolder: geminiResult.extractedData.accountHolder,
                    referenceNumber: geminiResult.extractedData.referenceNumber,
                    date: geminiResult.extractedData.date,
                    transferMethod: geminiResult.extractedData.transferMethod,
                    isPaymentProof: geminiResult.validation.isPaymentProof,
                    validation: geminiResult.validation
                },
                warnings: geminiResult.validation.riskReasons || []
            };
        }
        catch (error) {
            console.error('[AdvancedAI] Extraction error:', error);
            return {
                passed: false,
                confidence: 0,
                details: { error: error.message },
                warnings: ['Error during extraction']
            };
        }
    }
    /**
     * Enhanced amount extraction with specialized prompt
     */
    static async enhancedAmountExtraction(imageBuffer) {
        try {
            const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
            const apiKey = await AISettingsService_1.AISettingsService.getAPIKey();
            if (!apiKey)
                return null;
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const base64Image = imageBuffer.toString('base64');
            const prompt = `Analisis gambar bukti transfer ini dan ekstrak HANYA informasi berikut dalam format JSON:

{
  "amount": <nominal transfer dalam angka, tanpa titik/koma, contoh: 150000>,
  "bank": "<nama bank/e-wallet, contoh: BRI, Mandiri, Dana, OVO>",
  "referenceNumber": "<nomor referensi/transaksi jika ada>"
}

PENTING:
- Fokus hanya pada nominal transfer/jumlah yang ditransfer
- Abaikan saldo, biaya admin, dll
- Pastikan response hanya berisi JSON valid
- Jika tidak bisa membaca, kembalikan {"amount": null}`;
            const result = await model.generateContent([
                { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
                prompt
            ]);
            const text = result.response.text().trim();
            let jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(jsonText);
            if (parsed.amount && typeof parsed.amount === 'number') {
                return {
                    amount: parsed.amount,
                    bank: parsed.bank,
                    referenceNumber: parsed.referenceNumber
                };
            }
            return null;
        }
        catch (error) {
            console.warn('[AdvancedAI] Enhanced extraction failed:', error);
            return null;
        }
    }
    /**
     * Stage 2: Match extracted amount with invoices
     */
    static async stageMatching(customerId, extractedAmount, specificInvoiceId) {
        try {
            // Get unpaid invoices
            let query = `
                SELECT i.*, c.name as customer_name
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.customer_id = ?
                AND i.status IN ('sent', 'partial', 'overdue')
                AND i.remaining_amount > 0
            `;
            const params = [customerId];
            if (specificInvoiceId) {
                query += ' AND i.id = ?';
                params.push(specificInvoiceId);
            }
            query += ' ORDER BY i.due_date ASC, i.created_at DESC';
            const [invoices] = await pool_1.databasePool.query(query, params);
            if (invoices.length === 0) {
                return {
                    passed: false,
                    confidence: 0,
                    details: {
                        error: 'Tidak ada tagihan yang belum dibayar',
                        invoiceCount: 0
                    },
                    warnings: []
                };
            }
            // Smart matching with tolerance levels
            let bestMatch = null;
            let matchType = 'mismatch';
            let matchConfidence = 0;
            for (const invoice of invoices) {
                const remaining = parseFloat(invoice.remaining_amount.toString());
                const total = parseFloat(invoice.total_amount.toString());
                const diff = Math.abs(extractedAmount - remaining);
                const totalDiff = Math.abs(extractedAmount - total);
                // Exact match (within 500 rupiah)
                if (diff <= 500) {
                    bestMatch = invoice;
                    matchType = 'exact';
                    matchConfidence = 100;
                    break;
                }
                // Close match (within 1% or 5000 rupiah)
                const tolerance = Math.max(remaining * 0.01, 5000);
                if (diff <= tolerance) {
                    if (!bestMatch || matchConfidence < 90) {
                        bestMatch = invoice;
                        matchType = 'close';
                        matchConfidence = 90 - (diff / tolerance) * 10;
                    }
                }
                // Check total amount match (for full payment after partial)
                if (totalDiff <= 500) {
                    if (!bestMatch || matchConfidence < 85) {
                        bestMatch = invoice;
                        matchType = 'close';
                        matchConfidence = 85;
                    }
                }
                // Partial payment check (amount is less but reasonable)
                // STRICT MODE: Only allow partial if explicit enabled or very specific conditions
                // For now, we allow it to be 'bestMatch' but 'partial' type will be flagged in approval
                if (extractedAmount < remaining && extractedAmount >= remaining * 0.5) {
                    if (!bestMatch || matchConfidence < 70) {
                        bestMatch = invoice;
                        matchType = 'partial';
                        matchConfidence = 70;
                    }
                }
            }
            if (!bestMatch) {
                // No good match, suggest closest
                const closest = invoices[0];
                const remaining = parseFloat(closest.remaining_amount.toString());
                return {
                    passed: false,
                    confidence: 30,
                    details: {
                        error: `Nominal tidak sesuai. Transfer: Rp ${extractedAmount.toLocaleString('id-ID')}, Tagihan: Rp ${remaining.toLocaleString('id-ID')}`,
                        suggestedInvoice: closest,
                        extractedAmount,
                        expectedAmount: remaining
                    },
                    warnings: ['Nominal tidak cocok dengan tagihan manapun']
                };
            }
            return {
                passed: true,
                confidence: matchConfidence,
                details: {
                    invoice: bestMatch,
                    matchType,
                    extractedAmount,
                    expectedAmount: parseFloat(bestMatch.remaining_amount.toString())
                },
                warnings: matchType === 'partial' ? ['Pembayaran parsial terdeteksi'] : []
            };
        }
        catch (error) {
            console.error('[AdvancedAI] Matching error:', error);
            return {
                passed: false,
                confidence: 0,
                details: { error: error.message },
                warnings: []
            };
        }
    }
    /**
     * Stage 3: Validate payment proof with fraud detection
     */
    static async stageValidation(imageBuffer, invoice, extractedData) {
        try {
            const geminiEnabled = await GeminiService_1.GeminiService.isEnabled();
            if (!geminiEnabled) {
                // Basic validation without AI
                return {
                    passed: true,
                    confidence: 60,
                    details: {
                        riskLevel: 'medium',
                        riskScore: 40,
                        fraudIndicators: [],
                        manualReviewRecommended: true
                    },
                    warnings: ['AI tidak aktif, validasi terbatas']
                };
            }
            // Get customer name for validation
            const expectedAmount = invoice ? parseFloat(invoice.remaining_amount.toString()) : undefined;
            const customerName = invoice?.customer_name;
            // Fetch company name for recipient verification
            let expectedRecipientName = 'Provider Internet';
            try {
                const [companyRows] = await pool_1.databasePool.query('SELECT company_name FROM company_settings LIMIT 1');
                if (companyRows.length > 0) {
                    expectedRecipientName = companyRows[0].company_name;
                }
            }
            catch (ignore) { }
            // Full Gemini validation
            // Check if this is a time-critical transaction (e.g. PPPoE / Prepaid)
            const isPrepaid = invoice?.invoice_number?.startsWith('INV') || true; // Default to strict 
            const validationResult = await GeminiService_1.GeminiService.analyzePaymentProof(imageBuffer, expectedAmount, undefined, // bank
            customerName, invoice?.invoice_number, expectedRecipientName, isPrepaid);
            const riskLevel = validationResult.validation.riskLevel;
            const riskScore = this.calculateRiskScore(validationResult);
            const fraudIndicators = validationResult.fraudIndicators || [];
            // Cast to string to handle potential 'critical' value from Gemini
            const riskLevelStr = String(riskLevel);
            return {
                passed: validationResult.isValid && riskLevelStr !== 'critical',
                confidence: validationResult.confidence,
                details: {
                    riskLevel: riskLevelStr,
                    riskScore,
                    fraudIndicators,
                    isPaymentProof: validationResult.validation.isPaymentProof,
                    isRecent: validationResult.validation.isRecent,
                    amountMatches: validationResult.validation.amountMatches,
                    hasManipulation: validationResult.validation.hasManipulation || false,
                    recommendation: validationResult.recommendation,
                    reasoning: validationResult.reasoning
                },
                warnings: validationResult.validation.riskReasons || []
            };
        }
        catch (error) {
            console.error('[AdvancedAI] Validation error:', error);
            return {
                passed: false,
                confidence: 0,
                details: {
                    error: error.message,
                    riskLevel: 'high',
                    riskScore: 80,
                    fraudIndicators: []
                },
                warnings: ['Validation failed']
            };
        }
    }
    /**
     * Calculate risk score from validation result
     */
    static calculateRiskScore(result) {
        let score = 0;
        // Base score from risk level
        switch (result.validation.riskLevel) {
            case 'low':
                score = 10;
                break;
            case 'medium':
                score = 40;
                break;
            case 'high':
                score = 70;
                break;
            default: score = 90;
        }
        // Adjust based on validation flags
        if (!result.validation.isPaymentProof)
            score += 30;
        if (!result.validation.isRecent)
            score += 15;
        if (!result.validation.amountMatches)
            score += 10;
        if (result.validation.hasManipulation)
            score += 40;
        // Adjust based on confidence
        score -= (result.confidence / 5); // Higher confidence reduces risk
        return Math.min(100, Math.max(0, Math.round(score)));
    }
    /**
     * Stage 4: Determine if auto-approve should happen
     */
    static async stageApproval(validationResult, matchDetails, extractedData, forceManualReview) {
        if (forceManualReview) {
            return {
                autoApprove: false,
                confidence: validationResult.confidence,
                reasoning: 'Manual review diminta secara eksplisit'
            };
        }
        // Get AI settings
        const settings = await AISettingsService_1.AISettingsService.getSettings();
        if (!settings?.auto_approve_enabled) {
            return {
                autoApprove: false,
                confidence: validationResult.confidence,
                reasoning: 'Auto-approve tidak diaktifkan di pengaturan'
            };
        }
        const minConfidence = settings.min_confidence || 70;
        const riskThreshold = settings.risk_threshold || 'medium';
        const riskScore = validationResult.details.riskScore || 50;
        const riskLevel = validationResult.details.riskLevel || 'medium';
        // Check confidence threshold
        if (validationResult.confidence < minConfidence) {
            return {
                autoApprove: false,
                confidence: validationResult.confidence,
                reasoning: `Confidence (${validationResult.confidence}%) di bawah minimum (${minConfidence}%)`
            };
        }
        // Check risk level threshold
        const riskLevels = ['low', 'medium', 'high', 'critical'];
        const currentRiskIndex = riskLevels.indexOf(riskLevel);
        const thresholdIndex = riskLevels.indexOf(riskThreshold);
        if (currentRiskIndex > thresholdIndex) {
            return {
                autoApprove: false,
                confidence: validationResult.confidence,
                reasoning: `Risk level (${riskLevel}) melebihi threshold (${riskThreshold})`
            };
        }
        // Check for critical fraud indicators
        const fraudIndicators = validationResult.details.fraudIndicators || [];
        const criticalIndicators = fraudIndicators.filter((ind) => ind.severity === 'critical' || ind.severity === 'high');
        if (criticalIndicators.length > 0) {
            return {
                autoApprove: false,
                confidence: validationResult.confidence,
                reasoning: `Ditemukan ${criticalIndicators.length} indikator fraud kritis`
            };
        }
        // Check amount match type
        // STRICT: If not allowing mismatch, we only accept EXACT matches (or extremely close ones < 500 IDR)
        if (!settings.allow_amount_mismatch) {
            if (matchDetails.matchType !== 'exact') {
                return {
                    autoApprove: false,
                    confidence: validationResult.confidence,
                    reasoning: `Nominal tidak 100% cocok (Type: ${matchDetails.matchType}). Dibutuhkan nominal persis.`
                };
            }
        }
        else {
            // Loose mode logic
            if (matchDetails.matchType === 'mismatch') {
                return {
                    autoApprove: false,
                    confidence: validationResult.confidence,
                    reasoning: 'Nominal tidak sesuai dengan tagihan'
                };
            }
        }
        // New Strict date check
        if (!validationResult.details.isRecent) {
            return {
                autoApprove: false,
                confidence: validationResult.confidence,
                reasoning: 'Bukti transfer sudah terlalu lama (> 48 jam)'
            };
        }
        // All checks passed - auto approve!
        return {
            autoApprove: true,
            confidence: validationResult.confidence,
            reasoning: `Auto-approved: Confidence ${validationResult.confidence}%, Risk ${riskLevel}, Amount match: ${matchDetails.matchType}`
        };
    }
    /**
     * Check if reference number already exists in payments table
     */
    static async checkReferenceNumber(ref) {
        if (!ref)
            return false;
        try {
            const [rows] = await pool_1.databasePool.query('SELECT id FROM payments WHERE reference_number = ?', [ref]);
            return rows.length > 0;
        }
        catch (error) {
            console.error('[AdvancedAI] Error checking reference number:', error);
            return false;
        }
    }
    /**
     * Verify if the date and time is within acceptable range (last 48 hours)
     */
    static async verifyDateTime(date, time) {
        if (!date)
            return true; // Fail safe if not extracted but Gemini says isRecent
        try {
            const transferDate = new Date(`${date} ${time || '00:00:00'}`);
            const now = new Date();
            const diffMs = now.getTime() - transferDate.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            // STRICT TIME RULE
            // Future dates (> 1 hour ahead) are rejected (allow slightly clock drift)
            // Old dates (> 24 hours) are rejected by default
            if (diffHours < -1)
                return false; // Future date detection
            return diffHours <= 24; // Default max 24 hours. (Prepaid 2 hours logic is handled by AI Prompt + isRecent flag)
        }
        catch (e) {
            return false;
        }
    }
    /**
     * Stage 5: Execute auto-approve actions
     */
    static async executeAutoApproveActions(customerId, invoice, paymentAmount, validationDetails) {
        const connection = await pool_1.databasePool.getConnection();
        let paymentRecorded = false;
        let isolationRemoved = false;
        let notificationSent = false;
        try {
            await connection.beginTransaction();
            // Record payment
            const currentPaid = parseFloat(invoice.paid_amount?.toString() || '0');
            const totalAmount = parseFloat(invoice.total_amount.toString());
            const remainingAmount = parseFloat(invoice.remaining_amount.toString());
            const effectivePayment = Math.min(paymentAmount, remainingAmount);
            const newPaid = currentPaid + effectivePayment;
            const newRemaining = totalAmount - newPaid;
            const isFullPayment = newRemaining <= 0;
            // Insert payment record
            const refNumber = validationDetails.referenceNumber || 'AI-AUTO';
            await connection.query(`INSERT INTO payments (invoice_id, payment_method, amount, payment_date, reference_number, notes, created_at)
                 VALUES (?, 'transfer', ?, NOW(), ?, ?, NOW())`, [invoice.id, effectivePayment, refNumber, `Auto-verified by AI (confidence: ${validationDetails.riskScore}%)`]);
            // Update invoice status
            const newStatus = isFullPayment ? 'paid' : 'partial';
            await connection.query(`UPDATE invoices 
                 SET paid_amount = ?, remaining_amount = ?, status = ?, 
                     last_payment_date = NOW(), paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END,
                     updated_at = NOW()
                 WHERE id = ?`, [newPaid, Math.max(0, newRemaining), newStatus, newStatus, invoice.id]);
            paymentRecorded = true;
            console.log(`[AdvancedAI] ✅ Payment recorded: Rp ${effectivePayment.toLocaleString('id-ID')}`);
            // Check if customer should be un-isolated
            if (isFullPayment) {
                // Check for other unpaid invoices
                const [unpaidCheck] = await connection.query(`SELECT COUNT(*) as count FROM invoices 
                     WHERE customer_id = ? AND id != ? AND status != 'paid' AND remaining_amount > 0`, [customerId, invoice.id]);
                const hasOtherUnpaid = unpaidCheck[0]?.count > 0;
                if (!hasOtherUnpaid) {
                    // Remove isolation
                    const [customerCheck] = await connection.query('SELECT is_isolated, connection_type FROM customers WHERE id = ?', [customerId]);
                    if (customerCheck[0]?.is_isolated) {
                        // Import and use IsolationService
                        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../billing/isolationService')));
                        const restoreResult = await IsolationService.isolateCustomer({
                            customer_id: customerId,
                            action: 'restore',
                            reason: 'Auto-restore: Invoice paid via AI verification',
                            performed_by: 'ai_system'
                        });
                        if (restoreResult) {
                            isolationRemoved = true;
                            console.log(`[AdvancedAI] ✅ Customer isolation removed`);
                        }
                    }
                }
            }
            await connection.commit();
            // Send notification
            try {
                const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../notification/UnifiedNotificationService')));
                await UnifiedNotificationService.queueNotification({
                    customer_id: customerId,
                    invoice_id: invoice.id,
                    notification_type: 'payment_receipt', // Use existing type
                    channels: ['whatsapp'],
                    variables: {
                        invoice_number: invoice.invoice_number,
                        amount: effectivePayment.toLocaleString('id-ID'),
                        status: isFullPayment ? 'LUNAS' : 'SEBAGIAN',
                        method: 'AI Auto-Verification'
                    },
                    priority: 'high'
                });
                notificationSent = true;
                console.log(`[AdvancedAI] ✅ Notification queued`);
            }
            catch (notifError) {
                console.warn('[AdvancedAI] Notification failed:', notifError);
            }
            // Log successful verification
            await this.logVerificationAttempt(customerId, 'success', 'Auto-approved and processed', {
                invoiceId: invoice.id,
                amount: effectivePayment,
                riskScore: validationDetails.riskScore
            });
        }
        catch (error) {
            await connection.rollback();
            console.error('[AdvancedAI] Action execution error:', error);
            throw error;
        }
        finally {
            connection.release();
        }
        return { paymentRecorded, isolationRemoved, notificationSent };
    }
    /**
     * Log verification attempt for analytics
     */
    static async logVerificationAttempt(customerId, status, reason, metadata) {
        try {
            await pool_1.databasePool.query(`INSERT INTO ai_verification_logs 
                 (customer_id, status, reason, metadata, created_at)
                 VALUES (?, ?, ?, ?, NOW())`, [customerId, status, reason, JSON.stringify(metadata || {})]);
        }
        catch (error) {
            console.warn('[AdvancedAI] Failed to log verification:', error);
        }
    }
    /**
     * Get verification statistics
     */
    static async getVerificationStatistics(dateRange) {
        try {
            let query = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as auto_approved,
                    SUM(CASE WHEN status = 'manual_review' THEN 1 ELSE 0 END) as manual_review,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as rejected,
                    AVG(JSON_EXTRACT(metadata, '$.confidence')) as avg_confidence
                FROM ai_verification_logs
            `;
            const params = [];
            if (dateRange) {
                query += ' WHERE created_at BETWEEN ? AND ?';
                params.push(dateRange.from, dateRange.to);
            }
            const [result] = await pool_1.databasePool.query(query, params);
            const stats = result[0];
            return {
                total: stats?.total || 0,
                autoApproved: stats?.auto_approved || 0,
                manualReview: stats?.manual_review || 0,
                rejected: stats?.rejected || 0,
                avgConfidence: stats?.avg_confidence || 0,
                avgProcessingTime: 0 // Would need to track this separately
            };
        }
        catch (error) {
            console.error('[AdvancedAI] Error getting stats:', error);
            return {
                total: 0,
                autoApproved: 0,
                manualReview: 0,
                rejected: 0,
                avgConfidence: 0,
                avgProcessingTime: 0
            };
        }
    }
}
exports.AdvancedPaymentVerificationService = AdvancedPaymentVerificationService;
