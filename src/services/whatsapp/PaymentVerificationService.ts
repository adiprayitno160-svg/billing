/**
 * Payment Verification Service
 * Handles payment proof verification using OCR and AI
 */

import { MessageMedia } from 'whatsapp-web.js';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import PrepaidActivationService from '../prepaid/PrepaidActivationService';
import { PrepaidPackageService } from '../prepaid/PrepaidPackageService';
import { OCRService } from '../payment/OCRService';
import { GeminiService } from '../payment/GeminiService';

export interface VerificationResult {
    success: boolean;
    error?: string;
    type?: 'prepaid' | 'postpaid';
    packageName?: string;
    invoiceNumber?: string;
    invoiceStatus?: string;
    amount?: number;
    confidence?: number;
}

export class PaymentVerificationService {
    /**
     * Verify payment proof automatically - AI will analyze and match
     * For both prepaid and postpaid customers
     */
    static async verifyPaymentProofAuto(
        media: MessageMedia,
        customerId: number,
        billingMode: 'prepaid' | 'postpaid' = 'postpaid'
    ): Promise<VerificationResult> {
        try {
            console.log(`[PaymentVerification] Auto-verifying payment proof for customer ${customerId} (${billingMode})`);

            // 1. Extract data from image using AI/OCR
            const extractedData = await this.extractPaymentData(media);

            if (!extractedData.success || !extractedData.amount) {
                return {
                    success: false,
                    error: extractedData.error || 'Gagal membaca jumlah transfer dari bukti transfer. Pastikan foto jelas.'
                };
            }

            const transferAmount = extractedData.amount;

            // 2. Match with pending payments based on billing mode
            if (billingMode === 'prepaid') {
                return await this.verifyPrepaidPayment(customerId, media, transferAmount, extractedData);
            } else {
                return await this.verifyPostpaidPayment(customerId, media, transferAmount, extractedData);
            }

        } catch (error: any) {
            console.error('[PaymentVerification] Error:', error);
            return {
                success: false,
                error: error.message || 'Terjadi kesalahan saat verifikasi'
            };
        }
    }

    /**
     * Verify prepaid payment
     */
    private static async verifyPrepaidPayment(
        customerId: number,
        media: MessageMedia,
        transferAmount: number,
        extractedData: any
    ): Promise<VerificationResult> {
        try {
            // Find pending purchase codes
            const [pendingCodes] = await databasePool.query<RowDataPacket[]>(
                `SELECT pc.*, pp.name as package_name
                 FROM purchase_codes pc
                 JOIN prepaid_packages pp ON pc.package_id = pp.id
                 WHERE pc.customer_id = ?
                 AND pc.status = 'pending'
                 AND pc.expires_at > NOW()
                 ORDER BY pc.created_at DESC`,
                [customerId]
            );

            if (pendingCodes.length === 0) {
                return {
                    success: false,
                    error: 'Tidak ada pembelian paket yang sedang menunggu pembayaran. Silakan beli paket terlebih dahulu dengan /paket'
                };
            }

            // Match by amount (find closest match)
            let bestMatch: any = null;
            let minDiff = Infinity;

            for (const code of pendingCodes) {
                const diff = Math.abs(transferAmount - parseFloat(code.amount.toString()));
                if (diff < minDiff && diff <= 1000) { // Allow 1000 rupiah tolerance
                    minDiff = diff;
                    bestMatch = code;
                }
            }

            if (!bestMatch) {
                return {
                    success: false,
                    error: `Jumlah transfer tidak sesuai dengan pembelian yang sedang menunggu. Jumlah yang ditemukan: Rp ${transferAmount.toLocaleString('id-ID')}`
                };
            }

            // Verify with AI
            const imageBuffer = Buffer.from(media.data, 'base64');
            const geminiEnabled = await GeminiService.isEnabled();
            
            if (geminiEnabled) {
                const geminiResult = await GeminiService.analyzePaymentProof(
                    imageBuffer,
                    parseFloat(bestMatch.amount.toString()),
                    undefined,
                    'prepaid'
                );

                if (!geminiResult.isValid || geminiResult.confidence < 0.6) {
                    return {
                        success: false,
                        error: 'Verifikasi AI gagal. Bukti transfer tidak valid atau tidak jelas.'
                    };
                }
            }

            // Activate package
            const activationResult = await PrepaidActivationService.activatePackage({
                customer_id: customerId,
                package_id: bestMatch.package_id,
                purchase_price: parseFloat(bestMatch.amount.toString())
            });

            if (!activationResult.success) {
                return {
                    success: false,
                    error: activationResult.error || 'Gagal mengaktifkan paket'
                };
            }

            // Update purchase code status
            await databasePool.query(
                'UPDATE purchase_codes SET status = ? WHERE id = ?',
                ['paid', bestMatch.id]
            );

            // Save payment record
            await this.savePaymentRecord(
                customerId,
                bestMatch.package_id,
                bestMatch.code,
                transferAmount,
                extractedData.bankAccount || 'Unknown',
                extractedData.transferDate || new Date()
            );

            return {
                success: true,
                type: 'prepaid',
                packageName: bestMatch.package_name,
                amount: transferAmount,
                confidence: 0.85
            };

        } catch (error: any) {
            console.error('[PaymentVerification] Error verifying prepaid:', error);
            return {
                success: false,
                error: error.message || 'Gagal memverifikasi pembayaran prepaid'
            };
        }
    }

    /**
     * Verify postpaid payment (invoice payment)
     */
    private static async verifyPostpaidPayment(
        customerId: number,
        media: MessageMedia,
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
            const imageBuffer = Buffer.from(media.data, 'base64');
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
                type: 'postpaid',
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

            const invoice = invoices[0];
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
     * Verify payment proof from image (legacy method for prepaid with purchase code)
     */
    static async verifyPaymentProof(
        media: MessageMedia,
        purchaseCode: string,
        customerId: number,
        packageId: number,
        expectedAmount: number
    ): Promise<VerificationResult> {
        try {
            console.log(`[PaymentVerification] Verifying payment proof for code: ${purchaseCode}`);

            // 1. Extract text from image using OCR/AI
            const extractedData = await this.extractPaymentData(media);

            if (!extractedData.success) {
                return {
                    success: false,
                    error: extractedData.error || 'Gagal membaca bukti transfer'
                };
            }

            // 2. Verify purchase code (flexible matching)
            // If OCR didn't extract code, we'll trust the user's purchase code
            let codeMatch = true;
            if (extractedData.purchaseCode) {
                codeMatch = extractedData.purchaseCode === purchaseCode || 
                           extractedData.purchaseCode.includes(purchaseCode) ||
                           purchaseCode.includes(extractedData.purchaseCode);
            }

            if (!codeMatch) {
                return {
                    success: false,
                    error: 'Kode pembelian tidak cocok dengan bukti transfer. Pastikan kode pembelian tercantum di keterangan transfer.'
                };
            }

            // 3. Verify amount (allow small difference for rounding)
            // If OCR didn't extract amount, use expected amount
            let verifiedAmount = expectedAmount;
            if (extractedData.amount) {
                const amountDiff = Math.abs(extractedData.amount - expectedAmount);
                const tolerance = 1000; // Allow 1000 rupiah difference

                if (amountDiff > tolerance) {
                    return {
                        success: false,
                        error: `Jumlah transfer tidak sesuai. Diharapkan: Rp ${expectedAmount.toLocaleString('id-ID')}, Ditemukan: Rp ${extractedData.amount.toLocaleString('id-ID')}`
                    };
                }
                verifiedAmount = extractedData.amount;
            }

            // 4. Verify using Gemini AI (if enabled) for additional validation
            const geminiEnabled = await GeminiService.isEnabled();
            if (geminiEnabled) {
                try {
                    const imageBuffer = Buffer.from(media.data, 'base64');
                    const geminiResult = await GeminiService.analyzePaymentProof(
                        imageBuffer,
                        expectedAmount,
                        undefined,
                        'prepaid'
                    );

                    if (!geminiResult.isValid || geminiResult.confidence < 0.6) {
                        console.warn('[PaymentVerification] Gemini validation failed, but continuing with manual verification');
                        // Don't fail, just log warning - manual verification can proceed
                    }
                } catch (geminiError: any) {
                    console.warn('[PaymentVerification] Gemini verification error (non-critical):', geminiError.message);
                    // Continue with manual verification
                }
            }

            // 5. Activate package
            const packageData = await PrepaidPackageService.getPackageById(packageId);
            if (!packageData) {
                return {
                    success: false,
                    error: 'Paket tidak ditemukan'
                };
            }

            const activationService = new PrepaidActivationService();
            const activationResult = await activationService.activatePackage({
                customer_id: customerId,
                package_id: packageId,
                purchase_price: expectedAmount
            });

            if (!activationResult.success) {
                return {
                    success: false,
                    error: activationResult.error || 'Gagal mengaktifkan paket'
                };
            }

            // 6. Save payment record
            await this.savePaymentRecord(
                customerId,
                packageId,
                purchaseCode,
                verifiedAmount,
                extractedData.bankAccount || 'Unknown',
                extractedData.transferDate || new Date()
            );

            return {
                success: true,
                packageName: packageData.name,
                amount: verifiedAmount,
                confidence: 0.85 // Default confidence for successful verification
            };

        } catch (error: any) {
            console.error('[PaymentVerification] Error:', error);
            return {
                success: false,
                error: error.message || 'Terjadi kesalahan saat verifikasi'
            };
        }
    }

    /**
     * Extract payment data from image using OCR/AI
     */
    private static async extractPaymentData(media: MessageMedia): Promise<{
        success: boolean;
        purchaseCode?: string;
        amount?: number;
        bankAccount?: string;
        transferDate?: Date;
        error?: string;
    }> {
        try {
            // Convert base64 to buffer
            const imageBuffer = Buffer.from(media.data, 'base64');

            // Try Gemini AI first (more accurate)
            const geminiEnabled = await GeminiService.isEnabled();
            if (geminiEnabled) {
                try {
                    console.log('[PaymentVerification] Using Gemini AI for extraction...');
                    const geminiResult = await GeminiService.analyzePaymentProof(
                        imageBuffer,
                        undefined, // expectedAmount - will verify later
                        undefined, // expectedBank
                        'prepaid' // transactionType
                    );

                    if (geminiResult.isValid && geminiResult.extractedData) {
                        const extracted = geminiResult.extractedData;
                        
                        // Extract purchase code from text
                        const purchaseCodeMatch = geminiResult.rawResponse?.match(/PKT[A-Z0-9]{8,12}/i) || 
                                                 extracted.referenceNumber?.match(/PKT[A-Z0-9]{8,12}/i);
                        const purchaseCode = purchaseCodeMatch ? purchaseCodeMatch[0].toUpperCase() : undefined;

                        return {
                            success: true,
                            purchaseCode: purchaseCode,
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

            // Extract purchase code from OCR text
            const purchaseCodeMatch = ocrResult.rawText.match(/PKT[A-Z0-9]{8,12}/i);
            const purchaseCode = purchaseCodeMatch ? purchaseCodeMatch[0].toUpperCase() : undefined;

            return {
                success: true,
                purchaseCode: purchaseCode,
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


    /**
     * Save payment record
     */
    private static async savePaymentRecord(
        customerId: number,
        packageId: number,
        purchaseCode: string,
        amount: number,
        bankAccount: string,
        transferDate: Date
    ): Promise<void> {
        try {
            await databasePool.query(
                `INSERT INTO payment_verifications 
                 (customer_id, package_id, purchase_code, amount, bank_account, transfer_date, status, verified_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'verified', NOW(), NOW())`,
                [customerId, packageId, purchaseCode, amount, bankAccount, transferDate]
            );

            console.log(`[PaymentVerification] Payment record saved for code: ${purchaseCode}`);

        } catch (error: any) {
            console.error('[PaymentVerification] Error saving payment record:', error);
            // Don't throw, payment is already processed
        }
    }
}

