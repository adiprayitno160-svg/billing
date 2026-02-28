/**
 * Payment Verification Service
 * Handles payment proof verification using OCR and AI
 */

// Media interface compatible with whatsapp-web.js
interface MediaMessage {
    data: string | Buffer; // base64 string or Buffer
    mimetype?: string;
    filename?: string;
}

import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

import { OCRService } from '../payment/OCRService';
import { GeminiService } from '../payment/GeminiService';
import { UnifiedNotificationService } from '../notification/UnifiedNotificationService';

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

            // Check customer billing mode
            const [customerRows] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, name, billing_mode, phone FROM customers WHERE id = ?',
                [customerId]
            );

            if (!customerRows || customerRows.length === 0) {
                return {
                    success: false,
                    error: 'Customer tidak ditemukan'
                };
            }

            const billingMode = customerRows[0].billing_mode;
            console.log(`[PaymentVerification] Customer billing mode: ${billingMode}`);

            // 1. Extract data from image using AI/OCR
            const extractedData = await this.extractPaymentData(media);

            if (!extractedData.success || !extractedData.amount) {
                return {
                    success: false,
                    error: extractedData.error || 'Gagal membaca jumlah transfer dari bukti transfer. Pastikan foto jelas.'
                };
            }

            const transferAmount = extractedData.amount;

            // 2. Route to appropriate verification based on billing mode
            if (billingMode === 'prepaid') {
                return await this.verifyPrepaidPayment(customerId, media, transferAmount, extractedData);
            } else {
                // Default to postpaid
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
     * Verify postpaid payment (invoice payment)
     */
    private static async verifyPostpaidPayment(
        customerId: number,
        media: MediaMessage,
        transferAmount: number,
        extractedData: any
    ): Promise<VerificationResult> {
        try {
            // 1. Get customer info
            const [customerRows] = await databasePool.query<RowDataPacket[]>(
                'SELECT name, phone FROM customers WHERE id = ?',
                [customerId]
            );
            const customerName = customerRows[0]?.name || '';
            const customerPhone = customerRows[0]?.phone || '';

            // 2. Find unpaid invoices
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

            // 3. Match by amount (find closest match)
            let bestMatch: any = null;
            let minDiff = Infinity;

            for (const invoice of invoices) {
                const remaining = parseFloat(invoice.remaining_amount.toString());
                const diff = Math.abs(transferAmount - remaining);

                // Relaxed tolerance to 5000 rupiah
                if (diff <= 5000) {
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestMatch = invoice;
                    }
                } else {
                    // Check if matches total amount
                    const total = parseFloat(invoice.total_amount.toString());
                    const totalDiff = Math.abs(transferAmount - total);
                    if (totalDiff <= 5000 && totalDiff < minDiff) {
                        minDiff = totalDiff;
                        bestMatch = invoice;
                    }
                }
            }

            // 4. Fallback matching: If no amount match, check name in OCR
            if (!bestMatch) {
                // If customer name matches anywhere in OCR/AI raw text and only one invoice pending, auto-match it
                const nameInOcr = extractedData.rawText?.toLowerCase()?.includes(customerName.toLowerCase());
                if (nameInOcr && invoices.length === 1) {
                    bestMatch = invoices[0];
                    console.log(`[PaymentVerification] Found name match in OCR and only one pending invoice. Using it.`);
                } else {
                    const invoiceList = invoices.map((inv: any) =>
                        `• ${inv.invoice_number}: Rp ${parseFloat(inv.remaining_amount.toString()).toLocaleString('id-ID')}`
                    ).join('\n');

                    return {
                        success: false,
                        error: `Jumlah transfer tidak sesuai dengan tagihan yang belum dibayar.\n\nJumlah yang ditemukan: Rp ${transferAmount.toLocaleString('id-ID')}\n\nTagihan yang belum dibayar:\n${invoiceList}`
                    };
                }
            }

            // 5. Double check with AI validation
            const imageBuffer = typeof media.data === 'string'
                ? Buffer.from(media.data, 'base64')
                : media.data;
            const geminiEnabled = await GeminiService.isEnabled();

            if (geminiEnabled) {
                try {
                    const expectedAmount = parseFloat(bestMatch.remaining_amount.toString());
                    const geminiResult = await GeminiService.analyzePaymentProof(
                        imageBuffer,
                        expectedAmount,
                        customerName,
                        'invoice'
                    );

                    // RELAXED RULE: If names match (even partially) or amount is exact, OR it is a valid proof with high confidence
                    const isPaymentProof = (geminiResult as any).isPaymentProof;
                    const amountMatches = (geminiResult as any).amountMatches || (geminiResult as any).validation?.metadata?.amountMatch === 'match';

                    if (isPaymentProof && (amountMatches || geminiResult.confidence > 0.7)) {
                        console.log(`[PaymentVerification] Relaxed verification: Payment proof detected with good match. Forcing validity.`);
                        geminiResult.isValid = true;
                    }

                    if (!geminiResult.isValid || geminiResult.confidence < 0.6) {
                        // Check if it's a technical error
                        const isTechnicalError = geminiResult.validation?.riskReasons?.some(r =>
                            r.includes('failed') || r.includes('API') || r.includes('FetchError')
                        );

                        if (isTechnicalError) {
                            console.warn('[PaymentVerification] AI verification technical error. Proceeding.');
                            geminiResult.isValid = true; // Fallback to trust
                        }
                        else if (geminiResult.validation?.riskLevel === 'high') {
                            return {
                                success: false,
                                error: `Verifikasi AI mendeteksi risiko tinggi: ${geminiResult.validation.riskReasons.join(', ')}`
                            };
                        }
                    }
                } catch (aiError: any) {
                    console.error('[PaymentVerification] AI verification skipped due to error:', aiError.message);
                }
            }

            // 6. Record payment
            const remainingAmount = parseFloat(bestMatch.remaining_amount.toString());
            const paymentAmount = Math.min(transferAmount, remainingAmount);
            const isFullPayment = paymentAmount >= remainingAmount;

            const paymentId = await this.recordInvoicePayment(
                bestMatch.id,
                customerId,
                paymentAmount,
                'transfer',
                `Verifikasi otomatis via WhatsApp - ${extractedData.bankAccount || 'Unknown'}`,
                extractedData.transferDate || new Date()
            );

            // Trigger notification
            UnifiedNotificationService.notifyPaymentReceived(paymentId).catch(err =>
                console.error('[PaymentVerification] Failed to trigger notification:', err)
            );

            // Save verification record
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
                confidence: 0.95
            };

        } catch (error: any) {
            console.error('[PaymentVerification] Error in verifyPostpaidPayment:', error);
            return {
                success: false,
                error: error.message || 'Terjadi kesalahan sistem saat verifikasi pembayaran.'
            };
        }
    }

    /**
     * Verify prepaid payment (Top-up with unique code)
     */
    private static async verifyPrepaidPayment(
        customerId: number,
        media: MediaMessage,
        transferAmount: number,
        extractedData: any
    ): Promise<VerificationResult> {
        try {
            console.log(`[PaymentVerification] Verifying prepaid payment for customer ${customerId}, amount: ${transferAmount}`);

            // Find pending payment request by unique code (last 3 digits)
            const uniqueCode = transferAmount % 1000; // Get last 3 digits

            const [paymentRequests] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM payment_requests
                 WHERE customer_id = ?
                 AND status = 'pending'
                 AND expires_at > NOW()
                 AND unique_code = ?
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [customerId, uniqueCode]
            );

            let paymentRequest: any = null;

            if (paymentRequests.length === 0) {
                // Try to find by amount match (without unique code)
                const [requestsByAmount] = await databasePool.query<RowDataPacket[]>(
                    `SELECT * FROM payment_requests
                     WHERE customer_id = ?
                     AND status = 'pending'
                     AND expires_at > NOW()
                     AND ABS(total_amount - ?) <= 1000
                     ORDER BY created_at DESC
                     LIMIT 1`,
                    [customerId, transferAmount]
                );

                if (requestsByAmount.length === 0) {
                    return {
                        success: false,
                        error: `Tidak ada permintaan pembayaran yang sesuai.\n\nJumlah transfer: Rp ${transferAmount.toLocaleString('id-ID')}\n\nPastikan:\n• Transfer tepat sampai 3 digit terakhir\n• Kode pembayaran belum kadaluarsa (max 1 jam)\n\nKetik */beli* untuk membuat kode pembayaran baru.`
                    };
                }

                paymentRequest = requestsByAmount[0];
            } else {
                paymentRequest = paymentRequests[0];
            }

            if (!paymentRequest) {
                return {
                    success: false,
                    error: 'Kode pembayaran tidak valid atau sudah kedaluarsa.\nKetik */beli* untuk membuat kode baru.'
                };
            }

            // Verify amount matches
            const expectedAmount = parseFloat(paymentRequest.total_amount.toString());
            const amountDiff = Math.abs(transferAmount - expectedAmount);

            if (amountDiff > 10) { // Allow 10 rupiah tolerance
                return {
                    success: false,
                    error: `Jumlah transfer tidak sesuai.\n\nYang dibayar: Rp ${transferAmount.toLocaleString('id-ID')}\nSeharusnya: Rp ${expectedAmount.toLocaleString('id-ID')}\n\nSelisih: Rp ${amountDiff.toLocaleString('id-ID')}`
                };
            }

            // Verify with AI if enabled
            const imageBuffer = typeof media.data === 'string'
                ? Buffer.from(media.data, 'base64')
                : media.data;
            const geminiEnabled = await GeminiService.isEnabled();

            if (geminiEnabled) {
                try {
                    const geminiResult = await GeminiService.analyzePaymentProof(
                        imageBuffer,
                        expectedAmount,
                        undefined,
                        'prepaid'
                    );

                    if (!geminiResult.isValid || geminiResult.confidence < 0.6) {
                        if (geminiResult.validation?.riskLevel === 'high') {
                            return {
                                success: false,
                                error: `Verifikasi AI mendeteksi risiko tinggi: ${geminiResult.validation.riskReasons.join(', ')}`
                            };
                        }
                    }
                } catch (aiError: any) {
                    console.error('[PaymentVerification] AI verification skipped due to error:', aiError.message);
                }
            }

            // Process prepaid top-up using PrepaidService.confirmPayment
            const { PrepaidService } = await import('../billing/PrepaidService');

            const processingResult = await PrepaidService.confirmPayment(
                paymentRequest.id,
                null, // verified_by (auto verification)
                'transfer' // payment method
            );

            if (!processingResult.success) {
                return {
                    success: false,
                    error: processingResult.message || 'Gagal memproses pembayaran prepaid'
                };
            }

            console.log(`[PaymentVerification] ✅ Prepaid payment verified and processed for customer ${customerId}`);

            return {
                success: true,
                invoiceNumber: `PREPAID-${paymentRequest.id}`,
                invoiceStatus: 'Sukses',
                amount: transferAmount,
                confidence: 0.9
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
     * Record invoice payment
     */
    private static async recordInvoicePayment(
        invoiceId: number,
        customerId: number,
        amount: number,
        paymentMethod: string,
        notes: string,
        paymentDate: Date
    ): Promise<number> {
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
            const [result] = await connection.query<ResultSetHeader>(
                `INSERT INTO payments (invoice_id, payment_method, amount, payment_date, notes, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [invoiceId, paymentMethod, amount, paymentDate, notes]
            );

            const paymentId = result.insertId;

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
                     last_payment_date = ?, 
                     updated_at = NOW()
                 WHERE id = ?`,
                [newPaid, newRemaining, newStatus, paymentDate, invoiceId]
            );

            // Remove isolation if paid
            if (newStatus === 'paid') {
                await connection.query(
                    'UPDATE customers SET is_isolated = FALSE WHERE id = ?',
                    [customerId]
                );

                // --- UNISOLATE IN MIKROTIK ---
                try {
                    // Get customer details (username, connection type)
                    const [custRows] = await connection.query<RowDataPacket[]>(
                        'SELECT pppoe_username, connection_type, ip_address FROM customers WHERE id = ?',
                        [customerId]
                    );

                    if (custRows.length > 0) {
                        const customer = custRows[0];

                        // Dynamically import MikrotikService to avoid circular dependency
                        const { MikrotikService } = await import('../mikrotik/MikrotikService');
                        const mikrotik = await MikrotikService.getInstance();

                        if (customer.connection_type === 'pppoe' && customer.pppoe_username) {
                            console.log(`[PaymentVerification] Re-enabling PPPoE user: ${customer.pppoe_username}`);
                            await mikrotik.updatePPPoEUserByUsername(customer.pppoe_username, { disabled: false });
                            // Optionally kick user so they reconnect with valid status? Usually not needed if just enabling.
                        }
                        // Add other connection types if needed (e.g. Static IP Address list removal)
                    }
                } catch (mtError: any) {
                    console.error('[PaymentVerification] Failed to re-enable Mikrotik user:', mtError.message);
                    // Don't fail the payment record just because MT failed, but log it.
                }
                // -----------------------------
            }

            await connection.commit();

            return paymentId;

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

