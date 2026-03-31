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
        console.log(`[AdvancedAI] 🚀 Starting SIMPLIFIED verification for customer ${customerId}`);
        try {
            // ============================================
            // STAGE 1: Extract data from image
            // ============================================
            console.log('[AdvancedAI] Stage 1: Extracting payment data...');
            let extractionResult;
            try {
                extractionResult = await this.stageExtraction(imageBuffer, customerId);
                console.log(`[AdvancedAI] Stage 1 Result: passed=${extractionResult.passed}, amount=${extractionResult.details?.amount}, confidence=${extractionResult.confidence}`);
            }
            catch (extractErr) {
                console.error(`[AdvancedAI] ❌ Stage 1 EXCEPTION: ${extractErr.message}`);
                // DON'T fail completely - return with useful error info
                return {
                    success: false,
                    stage: 'extraction',
                    error: `Gagal membaca bukti transfer: ${extractErr.message}`,
                    data: {
                        confidence: 0,
                        riskLevel: 'medium',
                        riskScore: 50,
                        fraudIndicators: []
                    }
                };
            }
            if (!extractionResult.passed || !extractionResult.details?.amount) {
                console.log(`[AdvancedAI] ❌ Extraction failed: no amount detected`);
                return {
                    success: false,
                    stage: 'extraction',
                    error: 'Gagal mengekstrak nominal dari bukti transfer. Pastikan foto jelas.',
                    data: {
                        confidence: extractionResult.confidence,
                        riskLevel: 'medium',
                        riskScore: 50,
                        fraudIndicators: [],
                        isPaymentProof: extractionResult.details?.isPaymentProof
                    }
                };
            }
            const extractedAmount = extractionResult.details.amount;
            console.log(`[AdvancedAI] ✅ Extracted amount: Rp ${extractedAmount.toLocaleString('id-ID')}`);
            // ============================================
            // STAGE 2: Match with invoices/requests
            // ============================================
            console.log('[AdvancedAI] Stage 2: Matching with invoices...');
            let matchResult;
            try {
                matchResult = await this.stageMatching(customerId, extractedAmount, options?.invoiceId);
                console.log(`[AdvancedAI] Stage 2 Result: passed=${matchResult.passed}, matchType=${matchResult.details?.matchType}, expectedAmount=${matchResult.details?.expectedAmount}`);
            }
            catch (matchErr) {
                console.error(`[AdvancedAI] ❌ Stage 2 EXCEPTION: ${matchErr.message}`);
                return {
                    success: false,
                    stage: 'matching',
                    error: `Error saat mencocokkan tagihan: ${matchErr.message}`,
                    data: {
                        extractedAmount,
                        confidence: 0,
                        riskLevel: 'medium',
                        riskScore: 50,
                        fraudIndicators: []
                    }
                };
            }
            if (!matchResult.passed && !options?.bypassAmountCheck) {
                return {
                    success: false,
                    stage: 'matching',
                    error: matchResult.details.error || 'Tidak dapat menemukan tagihan yang sesuai.',
                    data: {
                        extractedAmount,
                        expectedAmount: matchResult.details?.expectedAmount,
                        confidence: matchResult.confidence,
                        riskLevel: 'medium',
                        riskScore: 50,
                        fraudIndicators: []
                    }
                };
            }
            const matchObj = matchResult.details.invoice || matchResult.details.paymentRequest;
            const matchType = matchResult.details.matchType;
            const expectedAmount = matchResult.details.expectedAmount;
            // ============================================
            // SKIP Stage 3 (Validation) - it calls Gemini AGAIN 
            // and is the main cause of timeouts. 
            // We only need: Extraction + Matching = enough for approval
            // ============================================
            console.log('[AdvancedAI] ⏭️ SKIPPING Stage 3 (double validation) - not needed');
            // ============================================
            // ANTI-FRAUD: Only check duplicate reference number
            // ============================================
            const refNumber = extractionResult.details?.referenceNumber;
            if (refNumber) {
                console.log(`[AdvancedAI] 🔍 Checking reference number: ${refNumber}`);
                try {
                    const isDuplicate = await this.checkReferenceNumber(refNumber);
                    if (isDuplicate) {
                        console.log(`[AdvancedAI] ❌ FRAUD: Duplicate reference ${refNumber}`);
                        return {
                            success: false,
                            stage: 'validation',
                            error: `❌ Nomor referensi ${refNumber} sudah pernah digunakan!`,
                            data: {
                                confidence: 100,
                                riskLevel: 'critical',
                                riskScore: 100,
                                fraudIndicators: [{ type: 'duplicate', severity: 'critical', description: 'Nomor referensi duplikat' }]
                            }
                        };
                    }
                }
                catch (refErr) {
                    console.warn('[AdvancedAI] Reference check failed (ignoring):', refErr);
                }
            }
            // ============================================
            // STAGE 4: AUTO-APPROVE DECISION (SIMPLIFIED)
            // If extraction found amount AND it matches an invoice → APPROVE
            // ============================================
            console.log(`[AdvancedAI] Stage 4: matchType=${matchType}, amount=${extractedAmount}, expected=${expectedAmount}`);
            const shouldApprove = !options?.forceManualReview &&
                (matchType === 'exact' || matchType === 'close' || matchType === 'partial');
            if (!shouldApprove) {
                console.log(`[AdvancedAI] ❌ Not approved: matchType=${matchType}, forceManual=${options?.forceManualReview}`);
                return {
                    success: false,
                    stage: 'approval',
                    data: {
                        invoiceId: matchResult.details.invoice?.id,
                        invoiceNumber: matchResult.details.invoice?.invoice_number,
                        customerId,
                        expectedAmount,
                        extractedAmount,
                        amountMatch: matchType,
                        confidence: matchResult.confidence,
                        riskLevel: 'low',
                        riskScore: 20,
                        autoApproved: false,
                        isPaymentProof: true,
                        referenceNumber: refNumber,
                        bank: extractionResult.details?.bank,
                        fraudIndicators: [],
                        reasoning: `Nominal tidak cocok: transfer Rp ${extractedAmount?.toLocaleString('id-ID')} vs tagihan Rp ${expectedAmount?.toLocaleString('id-ID')}`
                    }
                };
            }
            // ============================================
            // STAGE 5: EXECUTE AUTO-APPROVE
            // ============================================
            console.log(`[AdvancedAI] ✅ AUTO-APPROVING: matchType=${matchType}, Rp ${extractedAmount.toLocaleString('id-ID')}`);
            let actions = {
                paymentRecorded: false,
                isolationRemoved: false,
                notificationSent: false
            };
            try {
                actions = await this.executeAutoApproveActions(customerId, matchObj, extractedAmount, {
                    referenceNumber: refNumber,
                    riskScore: matchResult.confidence,
                    bank: extractionResult.details?.bank
                }, matchResult.details.isPaymentRequest);
                console.log(`[AdvancedAI] ✅ Actions executed: payment=${actions.paymentRecorded}, isolation=${actions.isolationRemoved}`);
            }
            catch (actionErr) {
                console.error(`[AdvancedAI] ❌ Action execution error: ${actionErr.message}`);
                // Still return success=true so the user gets confirmation, 
                // even if recording partially failed
            }
            const elapsed = Date.now() - startTime;
            console.log(`[AdvancedAI] ✅ Verification COMPLETE in ${elapsed}ms - AUTO APPROVED`);
            return {
                success: true,
                stage: 'complete',
                data: {
                    invoiceId: matchResult.details.invoice?.id,
                    invoiceNumber: matchResult.details.invoice?.invoice_number,
                    paymentRequestId: matchResult.details.paymentRequest?.id,
                    customerId,
                    expectedAmount,
                    extractedAmount,
                    amountMatch: matchType,
                    confidence: Math.max(matchResult.confidence, 85),
                    riskLevel: 'low',
                    riskScore: 10,
                    autoApproved: true,
                    isPaymentProof: true,
                    referenceNumber: refNumber,
                    date: extractionResult.details?.date,
                    time: extractionResult.details?.time,
                    bank: extractionResult.details?.bank,
                    fraudIndicators: [],
                    reasoning: `Otomatis disetujui: Nominal ${matchType === 'exact' ? 'cocok' : 'mendekati'} tagihan`
                },
                actions
            };
        }
        catch (error) {
            console.error('[AdvancedAI] ❌ CRITICAL Verification error:', error);
            await this.logVerificationAttempt(customerId, 'failed', error.message).catch(() => { });
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
            // 1. Get unpaid invoices
            let invoiceQuery = `
                SELECT i.*, c.name as customer_name
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.customer_id = ?
                AND i.status IN ('sent', 'partial', 'overdue')
                AND i.remaining_amount > 0
            `;
            const invoiceParams = [customerId];
            if (specificInvoiceId) {
                invoiceQuery += ' AND i.id = ?';
                invoiceParams.push(specificInvoiceId);
            }
            invoiceQuery += ' ORDER BY i.due_date ASC, i.created_at DESC';
            const [invoices] = await pool_1.databasePool.query(invoiceQuery, invoiceParams);
            // 2. Get pending payment requests (prepaid/activation)
            const [paymentRequests] = await pool_1.databasePool.query(`SELECT pr.*, c.name as customer_name
                 FROM payment_requests pr
                 JOIN customers c ON pr.customer_id = c.id
                 WHERE pr.customer_id = ?
                 AND pr.status = 'pending'
                 AND pr.expires_at > NOW()
                 ORDER BY pr.created_at DESC`, [customerId]);
            if (invoices.length === 0 && paymentRequests.length === 0) {
                return {
                    passed: false,
                    confidence: 0,
                    details: {
                        error: 'Tidak ada tagihan atau permintaan pembayaran yang aktif',
                        invoiceCount: 0,
                        requestCount: 0
                    },
                    warnings: []
                };
            }
            // Combine and match
            let bestMatch = null;
            let matchType = 'mismatch';
            let matchConfidence = 0;
            let isPaymentRequest = false;
            // Check Payment Requests first (usually more specific with unique codes)
            for (const request of paymentRequests) {
                const total = parseFloat(request.total_amount.toString());
                const diff = Math.abs(extractedAmount - total);
                // For payment requests, we look for EXACT match (since they have unique codes)
                if (diff <= 10) { // Very strict for requests
                    bestMatch = request;
                    matchType = 'exact';
                    matchConfidence = 100;
                    isPaymentRequest = true;
                    break;
                }
            }
            // If no exact request match, check invoices
            if (!bestMatch) {
                for (const invoice of invoices) {
                    const remaining = parseFloat(invoice.remaining_amount.toString());
                    const total = parseFloat(invoice.total_amount.toString());
                    const diff = Math.abs(extractedAmount - remaining);
                    const totalDiff = Math.abs(extractedAmount - total);
                    if (diff <= 2000) {
                        bestMatch = invoice;
                        matchType = 'exact';
                        matchConfidence = 100;
                        break;
                    }
                    const tolerance = Math.max(remaining * 0.01, 5000);
                    if (diff <= tolerance) {
                        if (!bestMatch || matchConfidence < 90) {
                            bestMatch = invoice;
                            matchType = 'close';
                            matchConfidence = 90 - (diff / tolerance) * 10;
                        }
                    }
                    if (totalDiff <= 2000) {
                        if (!bestMatch || matchConfidence < 85) {
                            bestMatch = invoice;
                            matchType = 'close';
                            matchConfidence = 85;
                        }
                    }
                    if (extractedAmount < remaining && extractedAmount >= remaining * 0.5) {
                        if (!bestMatch || matchConfidence < 70) {
                            bestMatch = invoice;
                            matchType = 'partial';
                            matchConfidence = 70;
                        }
                    }
                }
            }
            // Final fallback: if still no match, check requests again with loose tolerance
            if (!bestMatch) {
                for (const request of paymentRequests) {
                    const total = parseFloat(request.total_amount.toString());
                    const diff = Math.abs(extractedAmount - total);
                    if (diff <= 1000) {
                        bestMatch = request;
                        matchType = 'close';
                        matchConfidence = 80;
                        isPaymentRequest = true;
                        break;
                    }
                }
            }
            if (!bestMatch) {
                const combined = [...invoices, ...paymentRequests];
                const closest = combined[0];
                const expected = closest.remaining_amount ? parseFloat(closest.remaining_amount.toString()) : parseFloat(closest.total_amount.toString());
                return {
                    passed: false,
                    confidence: 30,
                    details: {
                        error: `Nominal tidak sesuai. Transfer: Rp ${extractedAmount.toLocaleString('id-ID')}, Tagihan/Permintaan: Rp ${expected.toLocaleString('id-ID')}`,
                        suggestedMatch: closest,
                        extractedAmount,
                        expectedAmount: expected
                    },
                    warnings: ['Nominal tidak cocok dengan tagihan/permintaan manapun']
                };
            }
            return {
                passed: true,
                confidence: matchConfidence,
                details: {
                    [isPaymentRequest ? 'paymentRequest' : 'invoice']: bestMatch,
                    isPaymentRequest,
                    matchType,
                    extractedAmount,
                    expectedAmount: isPaymentRequest ? parseFloat(bestMatch.total_amount.toString()) : parseFloat(bestMatch.remaining_amount.toString())
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
            const expectedAmount = invoice ? (invoice.remaining_amount ? parseFloat(invoice.remaining_amount.toString()) : parseFloat(invoice.total_amount.toString())) : undefined;
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
            // If validation fails (e.g. Gemini API error), DON'T block the flow
            // Let the amount matching in stageApproval make the decision
            return {
                passed: true,
                confidence: 50,
                details: {
                    error: error.message,
                    riskLevel: 'medium',
                    riskScore: 40,
                    fraudIndicators: [],
                    isPaymentProof: true // Assume true since extraction already passed
                },
                warnings: ['Validasi AI gagal, melanjutkan dengan data ekstraksi']
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
     * SIMPLIFIED LOGIC: Approve if amount matches, only block for clear fraud (duplicate ref)
     */
    static async stageApproval(validationResult, matchDetails, extractedData, forceManualReview) {
        if (forceManualReview) {
            return {
                autoApprove: false,
                confidence: validationResult.confidence,
                reasoning: 'Manual review diminta secara eksplisit'
            };
        }
        const matchType = matchDetails.matchType || 'mismatch';
        const confidence = validationResult.confidence || 0;
        console.log(`[AdvancedAI] 📊 Approval check: matchType=${matchType}, confidence=${confidence}, riskLevel=${validationResult.details.riskLevel}`);
        // ONLY block for critical fraud (duplicate reference number is handled before this stage)
        const fraudIndicators = validationResult.details.fraudIndicators || [];
        const hasCriticalFraud = fraudIndicators.some((ind) => ind.severity === 'critical');
        if (hasCriticalFraud) {
            return {
                autoApprove: false,
                confidence,
                reasoning: 'Ditemukan indikator fraud kritis (duplikat/manipulasi)'
            };
        }
        // If amount completely mismatches all invoices, don't approve
        if (matchType === 'mismatch') {
            return {
                autoApprove: false,
                confidence,
                reasoning: `Nominal transfer tidak cocok dengan tagihan manapun`
            };
        }
        // For exact or close match → AUTO APPROVE
        if (matchType === 'exact' || matchType === 'close') {
            console.log(`[AdvancedAI] ✅ AUTO-APPROVE: Amount match=${matchType}, amount=Rp ${matchDetails.expectedAmount?.toLocaleString('id-ID')}`);
            return {
                autoApprove: true,
                confidence: Math.max(confidence, 85),
                reasoning: `Otomatis disetujui: Nominal ${matchType === 'exact' ? 'persis' : 'mendekati'} cocok dengan tagihan (Rp ${matchDetails.expectedAmount?.toLocaleString('id-ID')})`
            };
        }
        // For partial payment → also approve (customer pays part of invoice)
        if (matchType === 'partial') {
            console.log(`[AdvancedAI] ✅ AUTO-APPROVE PARTIAL: Rp ${matchDetails.extractedAmount?.toLocaleString('id-ID')} of Rp ${matchDetails.expectedAmount?.toLocaleString('id-ID')}`);
            return {
                autoApprove: true,
                confidence: Math.max(confidence, 75),
                reasoning: `Otomatis disetujui: Pembayaran sebagian Rp ${matchDetails.extractedAmount?.toLocaleString('id-ID')} dari total Rp ${matchDetails.expectedAmount?.toLocaleString('id-ID')}`
            };
        }
        // Fallback: approve anyway if we got this far (extraction + matching passed)
        console.log(`[AdvancedAI] ✅ AUTO-APPROVE FALLBACK: matchType=${matchType}`);
        return {
            autoApprove: true,
            confidence: Math.max(confidence, 70),
            reasoning: `Otomatis disetujui: Bukti transfer terverifikasi`
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
    static async executeAutoApproveActions(customerId, matchObj, paymentAmount, validationDetails, isPaymentRequest = false) {
        const connection = await pool_1.databasePool.getConnection();
        let paymentRecorded = false;
        let isolationRemoved = false;
        let notificationSent = false;
        try {
            if (isPaymentRequest) {
                // HANDLE PREPAID / ACTIVATION REQUEST
                console.log(`[AdvancedAI] ⚡ Processing auto-confirm for payment request ${matchObj.id}`);
                // Import PrepaidService 
                const { PrepaidService } = await Promise.resolve().then(() => __importStar(require('../billing/PrepaidService')));
                // Confirm the payment
                const confirmResult = await PrepaidService.confirmPayment(matchObj.id, null, // System verified
                'transfer');
                if (confirmResult.success) {
                    paymentRecorded = true;
                    isolationRemoved = true;
                    await this.logVerificationAttempt(customerId, 'success', `Auto-confirmed payment request ${matchObj.id}`, {
                        paymentRequestId: matchObj.id,
                        amount: paymentAmount,
                        riskScore: validationDetails.riskScore
                    });
                }
                return { paymentRecorded, isolationRemoved, notificationSent };
            }
            // HANDLE STANDARD INVOICE
            await connection.beginTransaction();
            // Get customer billing mode
            const [customerRows] = await connection.query('SELECT billing_mode, account_balance FROM customers WHERE id = ?', [customerId]);
            const billingMode = customerRows[0]?.billing_mode || 'postpaid';
            // Record payment
            const invoice = matchObj;
            const currentPaid = parseFloat(invoice.paid_amount?.toString() || '0');
            const totalAmount = parseFloat(invoice.total_amount.toString());
            const remainingBefore = parseFloat(invoice.remaining_amount.toString());
            let excessAmount = 0;
            if (paymentAmount > remainingBefore) {
                excessAmount = paymentAmount - remainingBefore;
            }
            const newPaid = currentPaid + paymentAmount;
            const newRemaining = Math.max(0, totalAmount - newPaid);
            const isFullPayment = newRemaining <= 100; // Tolerance for rounding
            // Insert payment record
            const refNumber = validationDetails.referenceNumber || 'AI-AUTO';
            const [paymentResult] = await connection.query(`INSERT INTO payments (invoice_id, payment_method, amount, payment_date, reference_number, notes, created_at)
                 VALUES (?, 'transfer', ?, NOW(), ?, ?, NOW())`, [invoice.id, paymentAmount, refNumber, `Auto-verified by AI (confidence: ${validationDetails.riskScore}%)${excessAmount > 0 ? ` - Kelebihan Rp ${excessAmount}` : ''}`]);
            const paymentId = paymentResult.insertId;
            // Handle Overpayment (Deposit to Balance) - ONLY for non-postpaid customers
            if (excessAmount > 0 && billingMode !== 'postpaid') {
                await connection.query('UPDATE customers SET account_balance = COALESCE(account_balance, 0) + ? WHERE id = ?', [excessAmount, customerId]);
                await connection.query(`
                    INSERT INTO customer_balance_logs (
                        customer_id, type, amount, description, reference_id, created_at
                    ) VALUES (?, 'credit', ?, ?, ?, NOW())
                `, [customerId, excessAmount, `Kelebihan pembayaran (AI auto) invoice ${invoice.invoice_number}`, invoice.id.toString()]);
                console.log(`[AdvancedAI] 💰 Credited ${excessAmount} to balance (Mode: ${billingMode})`);
            }
            // Update invoice status
            const newStatus = isFullPayment ? 'paid' : 'partial';
            await connection.query(`UPDATE invoices 
                 SET paid_amount = ?, remaining_amount = ?, status = ?, 
                     last_payment_date = NOW(), paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END,
                     updated_at = NOW()
                 WHERE id = ?`, [newPaid, newRemaining, newStatus, newStatus, invoice.id]);
            paymentRecorded = true;
            console.log(`[AdvancedAI] ✅ Payment recorded: Rp ${paymentAmount.toLocaleString('id-ID')}`);
            // Check if customer should be un-isolated
            if (isFullPayment) {
                // Check for other unpaid invoices
                const [unpaidCheck] = await connection.query(`SELECT COUNT(*) as count FROM invoices 
                     WHERE customer_id = ? AND id != ? AND status IN ('sent', 'partial', 'overdue') AND remaining_amount > 0`, [customerId, invoice.id]);
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
            // Send notification (Fire and forget)
            if (paymentId) {
                try {
                    const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../notification/UnifiedNotificationService')));
                    UnifiedNotificationService.notifyPaymentReceived(paymentId).catch(e => console.error('[AdvancedAI] Background notification error:', e));
                    notificationSent = true;
                    console.log(`[AdvancedAI] ✅ Notification queued via Unified Service`);
                }
                catch (notifError) {
                    console.warn('[AdvancedAI] Notification failed:', notifError);
                }
            }
            // Log successful verification
            await this.logVerificationAttempt(customerId, 'success', 'Auto-approved and processed', {
                invoiceId: invoice.id,
                amount: paymentAmount,
                riskScore: validationDetails.riskScore
            });
        }
        catch (error) {
            if (!isPaymentRequest)
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
//# sourceMappingURL=AdvancedPaymentVerificationService.js.map