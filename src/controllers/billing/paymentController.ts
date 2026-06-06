import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { BillingPaymentIntegration } from '../../services/payment/BillingPaymentIntegration';
import { PaymentGatewayService } from '../../services/payment/PaymentGatewayService';

import { getNextPeriod } from '../../utils/periodHelper';
import { IsolationService } from '../../services/billing/isolationService';

export class PaymentController {
    private billingPaymentService: BillingPaymentIntegration;

    constructor() {
        // Initialize payment gateway service
        const paymentConfig = {
            xendit: {
                apiKey: process.env.XENDIT_API_KEY || '',
                secretKey: process.env.XENDIT_SECRET_KEY || '',
                baseUrl: process.env.XENDIT_BASE_URL || 'https://api.xendit.co',
                webhookSecret: process.env.XENDIT_WEBHOOK_SECRET || '',
            },
            mitra: {
                apiKey: process.env.MITRA_API_KEY || '',
                secretKey: process.env.MITRA_SECRET_KEY || '',
                baseUrl: process.env.MITRA_BASE_URL || 'https://api.mitra.com',
                webhookSecret: process.env.MITRA_WEBHOOK_SECRET || '',
            },
            tripay: {
                apiKey: process.env.TRIPAY_API_KEY || '',
                secretKey: process.env.TRIPAY_SECRET_KEY || '',
                baseUrl: process.env.TRIPAY_BASE_URL || 'https://tripay.co.id/api',
                webhookSecret: process.env.TRIPAY_WEBHOOK_SECRET || '',
                merchantCode: process.env.TRIPAY_MERCHANT_CODE || '',
            },
        };

        const paymentService = new PaymentGatewayService(paymentConfig);
        this.billingPaymentService = new BillingPaymentIntegration(paymentService);
    }

    /**
     * Resend Payment Notification
     */
    async resendNotification(req: Request, res: Response): Promise<void> {
        try {
            const paymentId = parseInt(req.params.id);
            if (isNaN(paymentId)) {
                res.status(400).json({ success: false, message: 'Invalid Payment ID' });
                return;
            }

            const { UnifiedNotificationService } = await import('../../services/notification/UnifiedNotificationService');

            // Notify Customer (with isManualVerification = true to avoid AI Admin broadcast)
            await UnifiedNotificationService.notifyPaymentReceived(paymentId, true, true);

            // 2. Force send immediately
            const result = await UnifiedNotificationService.sendPendingNotifications(1);

            if (result.sent > 0) {
                res.json({ success: true, message: 'Notifikasi berhasil dikirim ulang via WhatsApp' });
            } else if (result.failed > 0) {
                res.json({ success: false, message: 'Gagal mengirim notifikasi. Cek log system.' });
            } else {
                res.json({ success: true, message: 'Notifikasi dalam antrian (queued)' });
            }

        } catch (error: any) {
            console.error('Error resending notification:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get payment history list
     */
    async getPaymentHistory(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const customer_id = req.query.customer_id as string || '';
            const payment_method = req.query.payment_method as string || '';
            let date_from = req.query.date_from as string || '';
            let date_to = req.query.date_to as string || '';
            let period = req.query.period as string || '';
            const format = req.query.format as string || '';
            const search = req.query.search as string || '';
            const whereConditions: string[] = [];
            const queryParams: any[] = [];

            if (search) {
                whereConditions.push('(c.name LIKE ? OR i.invoice_number LIKE ? OR p.reference_number LIKE ?)');
                const searchParam = `%${search}%`;
                queryParams.push(searchParam, searchParam, searchParam);
            }

            const offset = (page - 1) * limit;

            // Build query conditions
            if (customer_id) {
                whereConditions.push('i.customer_id = ?');
                queryParams.push(customer_id);
            }

            if (payment_method) {
                whereConditions.push('p.payment_method = ?');
                queryParams.push(payment_method);
            }

            const formatDate = (d: Date) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            // If period is not specified and no date/search filters exist, default to current month
            if (!period && !date_from && !date_to && !search && !customer_id) {
                const now = new Date();
                period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }

            // Handle period filtering
            if (period) {
                const [year, month] = period.split('-');
                const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
                const lastDay = new Date(parseInt(year), parseInt(month), 0);
                
                date_from = formatDate(firstDay);
                date_to = formatDate(lastDay);
            }

            if (date_from) {
                whereConditions.push('DATE(p.payment_date) >= ?');
                queryParams.push(date_from);
            }

            if (date_to) {
                whereConditions.push('DATE(p.payment_date) <= ?');
                queryParams.push(date_to);
            }

            // Set for filters object in view
            (req.query as any).date_from = date_from;
            (req.query as any).date_to = date_to;
            (req.query as any).period = period;

            const whereClause = whereConditions.length > 0
                ? 'WHERE ' + whereConditions.join(' AND ')
                : '';

            // Get payments
            const paymentsQuery = `
            SELECT 
                p.*,
                c.name as customer_name,
                c.customer_code,
                c.phone as customer_phone,
                c.connection_type,
                o.name as odc_name,
                i.invoice_number,
                i.period,
                i.customer_id,
                i.status as invoice_status,
                i.total_amount as invoice_total,
                i.paid_amount as invoice_paid,
                i.remaining_amount as invoice_remaining,
                (SELECT image_data FROM manual_payment_verifications 
                 WHERE invoice_id = p.invoice_id AND (status = 'approved' OR status = 'pending') 
                 LIMIT 1) as proof_image
            FROM payments p
            LEFT JOIN invoices i ON p.invoice_id = i.id
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN ftth_odc o ON c.odc_id = o.id
            ${whereClause}
            ORDER BY p.payment_date DESC, p.id DESC
            LIMIT ? OFFSET ?
        `;

            const countQuery = `
            SELECT COUNT(*) AS total
            FROM payments p
            LEFT JOIN invoices i ON p.invoice_id = i.id
            LEFT JOIN customers c ON i.customer_id = c.id
            ${whereClause}
        `;

            const [paymentsResult, countResult] = await Promise.all([
                databasePool.query(paymentsQuery, [...queryParams, limit, offset]),
                databasePool.query(countQuery, queryParams)
            ]);

            const payments = paymentsResult[0] as RowDataPacket[];
            const totalCount = (countResult[0] as RowDataPacket[])[0]?.total ?? 0;
            const totalPages = Math.ceil(totalCount / limit);

            // Get statistics
            const statsQuery = `
            SELECT 
                COUNT(*) as total_payments,
                SUM(p.amount) as total_amount,
                COUNT(DISTINCT i.customer_id) as unique_customers,
                SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END) as cash_amount,
                SUM(CASE WHEN p.payment_method = 'transfer' THEN p.amount ELSE 0 END) as transfer_amount,
                SUM(CASE WHEN p.payment_method = 'gateway' THEN p.amount ELSE 0 END) as gateway_amount
            FROM payments p
            LEFT JOIN invoices i ON p.invoice_id = i.id
            LEFT JOIN customers c ON i.customer_id = c.id
            ${whereClause}
        `;

            const [statsResult] = await databasePool.query(statsQuery, queryParams);
            const stats = (statsResult as any)[0];

            // Return JSON if format=json
            if (format === 'json') {
                res.json({
                    success: true,
                    payments,
                    stats,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalCount,
                        limit
                    },
                    filters: {
                        customer_id,
                        payment_method,
                        date_from,
                        date_to,
                        period
                    }
                });
                return;
            }

            // Otherwise render view
            res.render('billing/payment-history', {
                title: 'Riwayat Pembayaran',
                payments,
                stats,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit
                },
                filters: {
                    customer_id,
                    payment_method,
                    date_from,
                    date_to,
                    period
                }
            });
        } catch (error) {
            console.error('Error getting payment history:', error);
            const format = req.query.format as string || '';

            if (format === 'json') {
                res.status(500).json({
                    success: false,
                    message: 'Gagal memuat riwayat pembayaran',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            } else {
                res.status(500).render('error', {
                    title: 'Error',
                    message: 'Gagal memuat riwayat pembayaran'
                });
            }
        }
    }

    /**
     * Process FULL payment (pembayaran penuh)
     */
    async processFullPayment(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            const {
                invoice_id,
                payment_method,
                payment_date,
                reference_number,
                notes
            } = req.body;

            // Validate input
            if (!invoice_id || !payment_method) {
                res.status(400).json({
                    success: false,
                    message: 'Data tidak lengkap'
                });
                return;
            }

            // Get invoice info
            const [invoiceResult] = await conn.query<RowDataPacket[]>(`
                SELECT i.*, c.billing_mode, c.name as customer_name FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.id = ?
            `, [invoice_id]);

            const invoice = invoiceResult[0];

            if (!invoice) {
                res.status(404).json({
                    success: false,
                    message: 'Invoice tidak ditemukan'
                });
                await conn.rollback();
                return;
            }

            const remainingAmount = parseFloat(invoice.remaining_amount);

            if (remainingAmount <= 0) {
                res.status(400).json({
                    success: false,
                    message: 'Invoice sudah lunas'
                });
                await conn.rollback();
                return;
            }

            // Calculate discount
            const discountAmount = parseFloat(req.body.discount_amount || '0');
            const slaDiscountAmount = parseFloat(req.body.sla_discount_amount || '0');
            const manualDiscountAmount = parseFloat(req.body.manual_discount_value || '0');
            const manualDiscountType = req.body.manual_discount_type;
            const discountReason = req.body.discount_reason;

            // ACTUAL payment amount meant to be received (cash/transfer)
            // If full payment, we expect to receive: Remaining - Discount
            // However, verify if payment logic needs adjustment
            let finalPaymentAmount = remainingAmount;

            if (discountAmount > 0) {
                finalPaymentAmount = Math.max(0, remainingAmount - discountAmount);
            }

            const paymentDateStr = payment_date || new Date().toISOString().slice(0, 10);

            // Insert payment record
            const paymentInsertQuery = `
                INSERT INTO payments (
                    invoice_id, payment_method, amount, payment_date,
                    reference_number, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `;

            await conn.execute(paymentInsertQuery, [
                invoice_id,
                payment_method,
                finalPaymentAmount, // Record actual money received
                paymentDateStr,
                reference_number || null,
                notes || null
            ]);

            // Insert discount record if applicable
            if (discountAmount > 0) {
                // If we display combined discount, we might want to record separate entries
                // But for simplicity, let's record one entry or the main one

                // SLA Discount
                if (slaDiscountAmount > 0) {
                    await conn.execute(`
                        INSERT INTO discounts (
                            invoice_id, discount_type, discount_value, reason, created_at
                        ) VALUES (?, 'sla', ?, 'Kompensasi SLA', NOW())
                    `, [invoice_id, slaDiscountAmount]);
                }

                // Manual Discount
                if (manualDiscountAmount > 0) {
                    // Check if not included in SLA (to avoid double counting if logic changes)
                    // Here we assume total discount = sla + manual
                    const discountType = (manualDiscountType === 'downtime' || manualDiscountType === 'fixed' || manualDiscountType === 'percentage')
                        ? manualDiscountType
                        : 'manual';

                    await conn.execute(`
                        INSERT INTO discounts (
                            invoice_id, discount_type, discount_value, reason, created_at
                        ) VALUES (?, ?, ?, ?, NOW())
                    `, [invoice_id, discountType, manualDiscountAmount, discountReason || 'Diskon Manual']);
                }
            }

            // Update invoice - LUNAS
            // paid_amount should include ONLY money paid? or Money + Discount?
            // Usually paid_amount is money. discount_amount is discount.
            // remaining_amount = total - discount - paid.

            // We need to update existing discount_amount in invoice if it was 0?
            // Invoice table has discount_amount.
            const newDiscountTotal = parseFloat(invoice.discount_amount || 0) + discountAmount;
            const newPaidTotal = parseFloat(invoice.paid_amount || 0) + finalPaymentAmount;

            // Calculate new total amount (Subtotal + PPN + DeviceFee - Discount)
            const subtotal = parseFloat(invoice.subtotal || 0);
            const ppn = parseFloat(invoice.ppn_amount || 0);
            const deviceFee = parseFloat(invoice.device_fee || 0);
            const newTotalAmount = Math.max(0, (subtotal + ppn + deviceFee) - newDiscountTotal);

            const updateInvoiceQuery = `
                UPDATE invoices 
                SET 
                    paid_amount = ?,
                    discount_amount = ?,
                    total_amount = ?,
                    remaining_amount = 0,
                    status = 'paid',
                    last_payment_date = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;

            await conn.execute(updateInvoiceQuery, [
                newPaidTotal,
                newDiscountTotal,
                newTotalAmount,
                paymentDateStr,
                invoice_id
            ]);

            await conn.commit();

            // Sync with Accounting (Admin Path) - AFTER Commit to avoid Deadlock
            try {
                const [paymentRows] = await conn.query<RowDataPacket[]>(
                    'SELECT id FROM payments WHERE invoice_id = ? ORDER BY id DESC LIMIT 1',
                    [invoice_id]
                );
                if (paymentRows.length > 0) {
                    const { AccountingService } = await import('../../services/billing/accountingService');
                    // Async but with error logging
                    AccountingService.generatePaymentJournalEntry(paymentRows[0].id).catch(err => 
                        console.error('[AdminPayment] Journal Sync Error:', err)
                    );
                }
            } catch (accErr) {
                console.error('[AdminPayment] Accounting Service Import/Sync Error:', accErr);
            }

            // Background restore check
            const custId_full = invoice.customer_id;
            setTimeout(() => {
                IsolationService.restoreIfQualified(custId_full).catch(err => console.warn('Auto-restore background failed (full):', err));
            }, 500);

            // Release connection first before sending notification
            conn.release();

            // Reset PPPoE next_block_date and re-enable user if applicable ("Kesepakatan Final" Point 4 & 6)
            // Fire and forget to avoid blocking UI with MikroTik connection
            import('../../services/pppoe/pppoeActivationService').then(({ pppoeActivationService }) => {
                pppoeActivationService.resetNextBlockDate(invoice.customer_id).catch(err =>
                    console.error('Background PPPoE reset error:', err)
                );
            }).catch(e => console.error('Error importing PPPoE service:', e));

            // Send payment notification (Fire and forget to avoid blocking UI)
            try {
                const { UnifiedNotificationService } = await import('../../services/notification/UnifiedNotificationService');
                // Get payment ID
                const [paymentRows] = await databasePool.query(
                    'SELECT id FROM payments WHERE invoice_id = ? ORDER BY id DESC LIMIT 1',
                    [invoice_id]
                );
                if (Array.isArray(paymentRows) && paymentRows.length > 0 && (paymentRows[0] as any).id) {
                    // Don't await this, let it run in background
                    UnifiedNotificationService.notifyPaymentReceived((paymentRows[0] as any).id, true, true).catch(e =>
                        console.error('Background notification error:', e)
                    );
                }
            } catch (notifError) {
                console.error('Error initiating payment notification:', notifError);
            }

            res.json({
                success: true,
                message: 'Pembayaran penuh berhasil diproses',
                payment_amount: finalPaymentAmount,
                discount_amount: discountAmount || 0,
                invoice_status: 'paid'
            });

        } catch (error) {
            if (conn) {
                try { await conn.rollback(); } catch (e) { }
                try { conn.release(); } catch (e) { }
            }
            console.error('Error processing full payment:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error details:', errorMessage);
            res.status(500).json({
                success: false,
                message: 'Gagal memproses pembayaran: ' + errorMessage
            });
        }
    }

    /**
     * Process PARTIAL payment (pembayaran kurang/sebagian)
     */
    async processPartialPayment(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            const {
                invoice_id,
                payment_amount,
                payment_method,
                payment_date,
                reference_number,
                notes
            } = req.body;

            // Validate input
            if (!invoice_id || !payment_amount || !payment_method) {
                res.status(400).json({
                    success: false,
                    message: 'Data tidak lengkap'
                });
                return;
            }

            // Get invoice info
            const [invoiceResult] = await conn.query<RowDataPacket[]>(`
                SELECT i.*, c.billing_mode, c.name as customer_name FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.id = ?
            `, [invoice_id]);

            const invoice = invoiceResult[0];

            if (!invoice) {
                res.status(404).json({
                    success: false,
                    message: 'Invoice tidak ditemukan'
                });
                await conn.rollback();
                return;
            }

            const remainingAmount = parseFloat(invoice.remaining_amount);
            const paymentAmountFloat = parseFloat(payment_amount);

            if (paymentAmountFloat <= 0) {
                res.status(400).json({
                    success: false,
                    message: 'Jumlah pembayaran harus lebih dari 0'
                });
                await conn.rollback();
                return;
            }

            // Calculate excess amount
            let excessAmount = 0;
            if (paymentAmountFloat > remainingAmount) {
                excessAmount = paymentAmountFloat - remainingAmount;
            }

            // Append overpayment to notes
            let paymentNotes = notes || '';
            if (excessAmount > 0) {
                if (invoice.billing_mode === 'postpaid') {
                    paymentNotes = (paymentNotes ? paymentNotes + '. ' : '') + `Kelebihan bayar Rp ${new Intl.NumberFormat('id-ID').format(excessAmount)} (Pascabayar - Tidak masuk saldo).`;
                } else {
                    paymentNotes = (paymentNotes ? paymentNotes + '. ' : '') + `Kelebihan bayar Rp ${new Intl.NumberFormat('id-ID').format(excessAmount)} masuk ke saldo akun.`;
                }
            }

            const paymentDateStr = payment_date || new Date().toISOString().slice(0, 10);

            // Calculate discount
            const discountAmount = parseFloat(req.body.discount_amount || '0');
            const slaDiscountAmount = parseFloat(req.body.sla_discount_amount || '0');
            const manualDiscountAmount = parseFloat(req.body.manual_discount_value || '0');
            const discountReason = req.body.discount_reason;

            // Insert payment record
            const paymentInsertQuery = `
                INSERT INTO payments (
                    invoice_id, payment_method, amount, payment_date,
                    reference_number, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `;

            await conn.execute(paymentInsertQuery, [
                invoice_id,
                payment_method,
                paymentAmountFloat,
                paymentDateStr,
                reference_number || null,
                paymentNotes || null
            ]);

            // Record discounts if valid
            if (discountAmount > 0) {
                // SLA Discount
                if (slaDiscountAmount > 0) {
                    await conn.execute(`
                        INSERT INTO discounts (
                            invoice_id, discount_type, discount_value, reason, created_at
                        ) VALUES (?, 'sla', ?, 'Kompensasi SLA', NOW())
                    `, [invoice_id, slaDiscountAmount]);
                }

                // Manual Discount
                if (manualDiscountAmount > 0) {
                    const discountType = (req.body.manual_discount_type === 'downtime' || req.body.manual_discount_type === 'fixed' || req.body.manual_discount_type === 'percentage')
                        ? req.body.manual_discount_type
                        : 'manual';

                    await conn.execute(`
                        INSERT INTO discounts (
                            invoice_id, discount_type, discount_value, reason, created_at
                        ) VALUES (?, ?, ?, ?, NOW())
                    `, [invoice_id, discountType, manualDiscountAmount, discountReason || 'Diskon Manual']);
                }
            }

            // Calculate new paid and remaining amounts
            // New Paid = current paid + new payment
            const newPaidAmount = parseFloat(invoice.paid_amount) + paymentAmountFloat;

            // New Discount = current discount + new discount
            const newDiscountTotal = parseFloat(invoice.discount_amount || 0) + discountAmount;

            // Remaining = Total - Paid - Discount
            // BUT invoice.total_amount usually includes previous discounts? 
            // Standard approach: total_amount is Subtotal - Discount. 
            // In our system, total_amount seems to be the FINAL billable amount.
            // If we add MORE discount, we should REDUCE total_amount?

            // Let's assume total_amount should decrease if discount increases.
            // OR total_amount stays same, and remaining_amount prevents full payment?
            // "remaining_amount" in our table is explicitly stored.

            // If discount is applied NOW (during payment), it effectively reduces the debt.
            // So: Remaining = PreviousRemaining - Payment - NewDiscount

            let newRemainingAmount = parseFloat(invoice.remaining_amount) - paymentAmountFloat - discountAmount;

            if (newRemainingAmount < 0) newRemainingAmount = 0;

            // Determine new status
            let newStatus = 'partial';
            if (newRemainingAmount <= 100) { // Tolerance for rounding
                newStatus = 'paid';
                newRemainingAmount = 0;
            }

            // total_amount should reflect the ORIGINAL billed amount minus any new discount.
            // We use invoice.total_amount (not invoice.subtotal) as the base because
            // total_amount already includes carry-over items from previous months.
            // Discounts are deducted on top of this final total.
            // This prevents carry-over amounts from disappearing after a partial payment.
            const originalTotal = parseFloat(invoice.total_amount);
            const prevDiscountAmount = parseFloat(invoice.discount_amount || '0');
            const newTotalAmount = Math.max(0, originalTotal - (newDiscountTotal - prevDiscountAmount));

            // Update invoice
            const updateInvoiceQuery = `
                UPDATE invoices 
                SET 
                    paid_amount = ?,
                    discount_amount = ?,
                    total_amount = ?, 
                    remaining_amount = ?,
                    status = ?,
                    last_payment_date = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;

            await conn.execute(updateInvoiceQuery, [
                newPaidAmount,
                newDiscountTotal,
                newTotalAmount,
                newRemainingAmount,
                newStatus,
                paymentDateStr,
                invoice_id
            ]);

            // Handle Overpayment (Deposit to Balance) - ONLY for non-postpaid customers
            if (excessAmount > 0 && invoice.billing_mode !== 'postpaid') {
                await conn.execute('UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [excessAmount, invoice.customer_id]);

                await conn.execute(`
                    INSERT INTO customer_balance_logs (
                        customer_id, type, amount, description, reference_id, created_at
                    ) VALUES (?, 'credit', ?, ?, ?, NOW())
                `, [invoice.customer_id, excessAmount, `Kelebihan pembayaran invoice ${invoice.invoice_number}`, invoice_id.toString()]);

                console.log(`[Payment] credited ${excessAmount} to customer ${invoice.customer_id} (Mode: ${invoice.billing_mode})`);
            } else if (excessAmount > 0) {
                console.log(`[Payment] excess ${excessAmount} ignored for postpaid customer ${invoice.customer_id}`);
            }

            // Create or update debt tracking
            // Use newRemainingAmount

            if (newRemainingAmount > 0) {
                // UPSERT debt record instead of blind INSERT to avoid "double accounting" in debt tracking
                const [existingDebt] = await conn.query<RowDataPacket[]>(
                    'SELECT id FROM debt_tracking WHERE invoice_id = ? AND status = "active"',
                    [invoice_id]
                );

                if (existingDebt.length > 0) {
                    await conn.query(
                        'UPDATE debt_tracking SET debt_amount = ?, updated_at = NOW() WHERE id = ?',
                        [newRemainingAmount, existingDebt[0].id]
                    );
                } else {
                    const debtInsertQuery = `
                        INSERT INTO debt_tracking (
                            customer_id, invoice_id, debt_amount, debt_reason, debt_date,
                            status, notes, created_at, updated_at
                        ) VALUES (?, ?, ?, 'Pembayaran parsial - sisa tagihan', ?, 'active', ?, NOW(), NOW())
                    `;
                    await conn.execute(debtInsertQuery, [
                        invoice.customer_id,
                        invoice_id,
                        newRemainingAmount,
                        paymentDateStr,
                        `Sisa pembayaran dari invoice ${invoice.invoice_number}`
                    ]);
                }

                // Create/Update carry over record for next month
                const nextPeriod = getNextPeriod(invoice.period);
                await conn.execute(
                    'INSERT INTO carry_over_invoices (customer_id, carry_over_amount, target_period, status) VALUES (?, ?, ?, "pending") ON DUPLICATE KEY UPDATE carry_over_amount = ?',
                    [invoice.customer_id, newRemainingAmount, nextPeriod, newRemainingAmount]
                );
            }

            await conn.commit();

            // Sync with Accounting (Admin Path) - AFTER COMMIT
            try {
                const [paymentRows] = await conn.query<RowDataPacket[]>(
                    'SELECT id FROM payments WHERE invoice_id = ? ORDER BY id DESC LIMIT 1',
                    [invoice_id]
                );
                if (paymentRows.length > 0) {
                    const { AccountingService } = await import('../../services/billing/accountingService');
                    AccountingService.generatePaymentJournalEntry(paymentRows[0].id).catch(err => 
                        console.error('[AdminPartialPayment] Journal Sync Error:', err)
                    );
                }
            } catch (accErr) {
                console.error('[AdminPartialPayment] Accounting Sync Error:', accErr);
            }

            // Background restore check
            const custId_partial = invoice.customer_id;
            setTimeout(() => {
                IsolationService.restoreIfQualified(custId_partial).catch(err => console.warn('Auto-restore background failed (partial):', err));
            }, 500);

            // Release connection first before sending notification
            conn.release();

            // Send notification (Fire and forget)
            try {
                const { UnifiedNotificationService } = await import('../../services/notification/UnifiedNotificationService');
                // Get payment ID
                const [paymentRows] = await databasePool.query(
                    'SELECT id FROM payments WHERE invoice_id = ? ORDER BY id DESC LIMIT 1',
                    [invoice_id]
                );
                if (Array.isArray(paymentRows) && paymentRows.length > 0 && (paymentRows[0] as any).id) {
                    // Don't await this, let it run in background
                    UnifiedNotificationService.notifyPaymentReceived((paymentRows[0] as any).id, true, true).catch(e =>
                        console.error('Background notification error:', e)
                    );
                }
            } catch (notifError) {
                console.error('Error initiating payment notification:', notifError);
            }

            res.json({
                success: true,
                message: 'Pembayaran parsial berhasil diproses',
                payment_amount: paymentAmountFloat,
                discount_amount: discountAmount || 0,
                remaining_amount: newRemainingAmount,
                excess_amount: excessAmount,
                invoice_status: newStatus
            });

            // Reset PPPoE next_block_date if paid ("Kesepakatan Final" Point 4 & 6)
            if (newStatus === 'paid') {
                import('../../services/pppoe/pppoeActivationService').then(({ pppoeActivationService }) => {
                    pppoeActivationService.resetNextBlockDate(invoice.customer_id).catch(err =>
                        console.error('Background PPPoE reset error:', err)
                    );
                }).catch(e => console.error('Error importing PPPoE service:', e));
            }

        } catch (error) {
            if (conn) {
                try { await conn.rollback(); } catch (e) { }
                try { conn.release(); } catch (e) { }
            }
            console.error('Error processing partial payment:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error details:', errorMessage);
            res.status(500).json({
                success: false,
                message: 'Gagal memproses pembayaran: ' + errorMessage
            });
        }
    }

    /**
     * Process DEBT payment (pencatatan hutang sepenuhnya tanpa pembayaran)
     */
    async processDebtPayment(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            const {
                invoice_id,
                debt_reason,
                due_date,
                notes
            } = req.body;

            // Validate input
            if (!invoice_id) {
                res.status(400).json({
                    success: false,
                    message: 'Invoice ID tidak valid'
                });
                return;
            }

            // Get invoice info
            const [invoiceResult] = await conn.query<RowDataPacket[]>(`
                SELECT i.*, c.billing_mode, c.name as customer_name FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.id = ?
            `, [invoice_id]);

            const invoice = invoiceResult[0];

            if (!invoice) {
                res.status(404).json({
                    success: false,
                    message: 'Invoice tidak ditemukan'
                });
                await conn.rollback();
                return;
            }

            const remainingAmount = parseFloat(invoice.remaining_amount);

            if (remainingAmount <= 0) {
                res.status(400).json({
                    success: false,
                    message: 'Invoice sudah lunas, tidak ada hutang'
                });
                await conn.rollback();
                return;
            }

            // UPSERT debt record
            const [existingDebt] = await conn.query<RowDataPacket[]>(
                'SELECT id FROM debt_tracking WHERE invoice_id = ? AND status = "active"',
                [invoice_id]
            );

            if (existingDebt.length > 0) {
                await conn.query(
                    'UPDATE debt_tracking SET debt_amount = ?, debt_reason = ?, due_date = ?, updated_at = NOW() WHERE id = ?',
                    [remainingAmount, debt_reason || 'Pencatatan hutang pelanggan', due_date || null, existingDebt[0].id]
                );
            } else {
                const debtInsertQuery = `
                    INSERT INTO debt_tracking (
                        customer_id, invoice_id, debt_amount, debt_reason, debt_date,
                        due_date, status, notes, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, NOW(), ?, 'active', ?, NOW(), NOW())
                `;
                await conn.execute(debtInsertQuery, [
                    invoice.customer_id,
                    invoice_id,
                    remainingAmount,
                    debt_reason || 'Pencatatan hutang pelanggan',
                    due_date || null,
                    notes || null
                ]);
            }

            // Also ensure carry over is synced for debt type
            const nextPeriod = getNextPeriod(invoice.period);
            await conn.execute(
                'INSERT INTO carry_over_invoices (customer_id, carry_over_amount, target_period, status) VALUES (?, ?, ?, "pending") ON DUPLICATE KEY UPDATE carry_over_amount = ?',
                [invoice.customer_id, remainingAmount, nextPeriod, remainingAmount]
            );

            // Update invoice status to 'partial'
            await conn.execute(`
                UPDATE invoices 
                SET status = 'partial', updated_at = NOW()
                WHERE id = ?
            `, [invoice_id]);

            await conn.commit();

            // Release connection first before sending notification
            conn.release();

            // Send notification to customer (async, non-blocking)
            try {
                const [customerRows] = await databasePool.query<RowDataPacket[]>(
                    'SELECT name, phone, customer_code FROM customers WHERE id = ?',
                    [invoice.customer_id]
                );

                if (customerRows.length > 0 && customerRows[0].phone) {
                    const customer = customerRows[0];
                    const { UnifiedNotificationService } = await import('../../services/notification/UnifiedNotificationService');

                    console.log(`[PaymentController] Ã°Å¸â€œÂ± Sending debt notification to customer ${customer.name}...`);

                    const notificationIds = await UnifiedNotificationService.queueNotification({
                        customer_id: invoice.customer_id,
                        invoice_id: invoice_id,
                        notification_type: 'payment_debt',
                        channels: ['whatsapp'],
                        variables: {
                            customer_name: customer.name || 'Pelanggan',
                            invoice_number: invoice.invoice_number || '',
                            total_amount: parseFloat(invoice.total_amount || 0).toLocaleString('id-ID'),
                            debt_amount: remainingAmount.toLocaleString('id-ID'),
                            debt_reason: debt_reason || 'Pencatatan hutang pelanggan',
                            debt_date: new Date().toLocaleDateString('id-ID'),
                            due_date: due_date ? new Date(due_date).toLocaleDateString('id-ID') : '-',
                            notes: notes || 'Silakan hubungi customer service untuk informasi lebih lanjut'
                        },
                        priority: 'high',
                        send_immediately: true // Queue will handle dispatch in background
                    });

                    console.log(`[PaymentController] Ã¢Å“â€¦ Debt notification queued (IDs: ${notificationIds.join(', ')})`);
                } else {
                    console.log(`[PaymentController] Ã¢Å¡Â Ã¯Â¸Â No phone number for customer ${invoice.customer_id}, skipping notification`);
                }
            } catch (notifError: any) {
                console.error(`[PaymentController] Ã¢Å¡Â Ã¯Â¸Â Failed to send debt notification (non-critical):`, notifError.message);
                // Non-critical, debt recording already succeeded
            }

            const discountAmount = req.body.discount_amount || 0;

            res.json({
                success: true,
                message: 'Hutang berhasil dicatat',
                debt_amount: remainingAmount,
                invoice_number: invoice.invoice_number
            });

        } catch (error) {
            await conn.rollback();
            conn.release();
            console.error('Error processing debt payment:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error details:', errorMessage);
            res.status(500).json({
                success: false,
                message: 'Gagal mencatat hutang: ' + errorMessage
            });
        }
    }

    /**
     * Get debt tracking list
     */
    async getDebtTrackingList(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            let status = req.query.status as string || 'active';
            const search = req.query.search as string || '';
            const min_amount = parseFloat(req.query.min_amount as string) || 0;
            const format = req.query.format as string || '';

            const offset = (page - 1) * limit;

            // Build query conditions
            const whereConditions: string[] = ['1=1'];
            const queryParams: any[] = [];

            // Map status
            if (status === 'unpaid' || status === 'active') {
                whereConditions.push("(i.status IN ('overdue', 'partial', 'hutang') OR (i.status IN ('unpaid', 'sent') AND DATEDIFF(CURRENT_DATE, i.due_date) > 0))");
                whereConditions.push("i.remaining_amount > 0");
            } else if (status === 'resolved') {
                whereConditions.push("i.status = 'paid'");
                whereConditions.push("i.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"); // Only recent ones
            }

            if (search) {
                whereConditions.push('(c.name LIKE ? OR c.phone LIKE ? OR i.invoice_number LIKE ?)');
                const searchPattern = `%${search}%`;
                queryParams.push(searchPattern, searchPattern, searchPattern);
            }

            if (min_amount > 0) {
                whereConditions.push('i.remaining_amount >= ?');
                queryParams.push(min_amount);
            }

            const whereClause = 'WHERE ' + whereConditions.join(' AND ');

            // Get unified debts
            const debtsQuery = `
                SELECT 
                    i.id as invoice_id,
                    i.remaining_amount as debt_amount,
                    i.due_date as debt_date,
                    i.status as invoice_status,
                    i.invoice_number,
                    i.period,
                    i.total_amount as invoice_total,
                    i.created_at,
                    c.id as customer_id,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone as customer_phone,
                    DATEDIFF(CURRENT_DATE, i.due_date) as days_overdue,
                    (SELECT id FROM debt_tracking WHERE invoice_id = i.id LIMIT 1) as debt_tracking_id
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                ${whereClause}
                ORDER BY i.due_date ASC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) AS total
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                ${whereClause}
            `;

            const [debtsResult, countResult] = await Promise.all([
                databasePool.query(debtsQuery, [...queryParams, limit, offset]),
                databasePool.query(countQuery, queryParams)
            ]);

            const debts = (debtsResult[0] as RowDataPacket[]).map(d => ({
                ...d,
                id: d.invoice_id, // map id to invoice_id for frontend
                status: d.invoice_status === 'paid' ? 'resolved' : 'unpaid'
            }));
            const totalCount = (countResult[0] as RowDataPacket[])[0]?.total ?? 0;
            const totalPages = Math.ceil(totalCount / limit);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    SUM(CASE WHEN i.status != 'paid' THEN i.remaining_amount ELSE 0 END) as total_debt,
                    COUNT(DISTINCT CASE WHEN i.status != 'paid' THEN i.customer_id END) as customers_count,
                    COUNT(CASE WHEN i.status != 'paid' AND DATEDIFF(CURRENT_DATE, i.due_date) > 30 THEN 1 END) as overdue_count,
                    COUNT(CASE WHEN i.status = 'paid' AND MONTH(i.updated_at) = MONTH(CURRENT_DATE) THEN 1 END) as resolved_count
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                ${whereClause}
            `;

            const [summaryResult] = await databasePool.query(summaryQuery, queryParams);
            const summary = (summaryResult as RowDataPacket[])[0];

            if (format === 'json') {
                res.json({
                    success: true,
                    debts,
                    summary,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalCount,
                        limit
                    }
                });
                return;
            }

            res.render('billing/debt-tracking', {
                title: 'Pelacakan Hutang',
                debts,
                summary,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit
                },
                filters: {
                    status,
                    search,
                    min_amount
                }
            });
        } catch (error) {
            console.error('Error getting debt tracking list:', error);
            const format = req.query.format as string || '';

            if (format === 'json') {
                res.status(500).json({
                    success: false,
                    message: 'Gagal memuat data hutang',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            } else {
                res.status(500).render('error', {
                    title: 'Error',
                    message: 'Gagal memuat data hutang'
                });
            }
        }
    }

    /**
     * Resolve debt (mark as paid/resolved)
     */
    async resolveDebt(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            const { id: invoiceId } = req.params;
            const { payment_method, reference_number, notes } = req.body;

            // Get invoice info
            const [invoiceResult] = await conn.query<RowDataPacket[]>(`
                SELECT *
                FROM invoices
                WHERE id = ?
            `, [invoiceId]);

            const invoice = invoiceResult[0];

            if (!invoice) {
                res.status(404).json({
                    success: false,
                    message: 'Invoice tidak ditemukan'
                });
                await conn.rollback();
                return;
            }

            if (invoice.status === 'paid' || invoice.remaining_amount <= 0) {
                res.status(400).json({
                    success: false,
                    message: 'Hutang / Tunggakan sudah diselesaikan'
                });
                await conn.rollback();
                return;
            }

            const debtAmount = parseFloat(invoice.remaining_amount);

            // Create payment record
            const paymentInsertQuery = `
                INSERT INTO payments (
                    invoice_id, payment_method, amount, payment_date,
                    reference_number, notes, created_at
                ) VALUES (?, ?, ?, NOW(), ?, ?, NOW())
            `;

            await conn.execute(paymentInsertQuery, [
                invoice.id,
                payment_method || 'cash',
                debtAmount,
                reference_number || null,
                notes || `Pelunasan hutang/tunggakan`
            ]);

            // Mark debt_tracking as resolved if exists
            await conn.execute(`
                UPDATE debt_tracking 
                SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
                WHERE invoice_id = ? AND status = 'active'
            `, [invoice.id]);

            // Update invoice if this resolves all debt
            if (invoice) {
                const newPaidAmount = parseFloat(invoice.paid_amount) + debtAmount;
                const newRemainingAmount = parseFloat(invoice.total_amount) - newPaidAmount;

                let newStatus = invoice.status;
                if (newRemainingAmount <= 0.01) {
                    newStatus = 'paid';
                } else if (invoice.status === 'carried_over') {
                    // Keep it carried_over if not fully paid yet
                    newStatus = 'carried_over';
                }

                await conn.execute(`
                    UPDATE invoices 
                    SET 
                        paid_amount = ?,
                        remaining_amount = ?,
                        status = ?,
                        last_payment_date = NOW(),
                        updated_at = NOW()
                    WHERE id = ?
                `, [newPaidAmount, newRemainingAmount, newStatus, invoice.id]);

                // Check if there is a future invoice that absorbed this carry over debt
                if (invoice.status === 'carried_over') {
                    const [futureInvoices] = await conn.query<RowDataPacket[]>(`
                        SELECT id, total_amount, remaining_amount, subtotal
                        FROM invoices
                        WHERE customer_id = ? AND period > ? AND status NOT IN ('paid', 'cancelled')
                        ORDER BY period ASC LIMIT 1
                    `, [invoice.customer_id, invoice.period]);
                    
                    if (futureInvoices.length > 0) {
                        const fInv = futureInvoices[0];
                        const fRemaining = parseFloat(fInv.remaining_amount);
                        const fTotal = parseFloat(fInv.total_amount);
                        
                        // We deduct the debtAmount from the future invoice since it's already paid directly
                        const newFRemaining = Math.max(0, fRemaining - debtAmount);
                        const newFTotal = Math.max(0, fTotal - debtAmount);
                        let newFStatus = fInv.status;
                        
                        if (newFRemaining <= 0) {
                            newFStatus = 'paid';
                        }
                        
                        await conn.execute(`
                            UPDATE invoices 
                            SET total_amount = ?, remaining_amount = ?, status = ?
                            WHERE id = ?
                        `, [newFTotal, newFRemaining, newFStatus, fInv.id]);
                        
                        // Add a note about the correction
                        await conn.execute(`
                            UPDATE invoices
                            SET notes = CONCAT(COALESCE(notes, ''), '\n[Dikoreksi: Tunggakan lama Rp ', ?, ' telah dibayar terpisah]')
                            WHERE id = ?
                        `, [debtAmount, fInv.id]);
                        
                        // Also clear carry_over_invoices if it exists and hasn't been applied fully yet
                        // Just in case it's pending
                        await conn.execute(`
                            UPDATE carry_over_invoices 
                            SET carry_over_amount = GREATEST(0, carry_over_amount - ?),
                                status = CASE WHEN carry_over_amount - ? <= 0 THEN 'cancelled' ELSE status END
                            WHERE customer_id = ? AND status = 'pending'
                        `, [debtAmount, debtAmount, invoice.customer_id]);
                    }
                }
            }

            await conn.commit();

            // Trigger auto-restore isolation if customer has no more unpaid invoices
            setTimeout(async () => {
                try {
                    const { IsolationService } = await import('../../services/billing/isolationService');
                    await IsolationService.restoreIfQualified(invoice.customer_id);
                } catch (restoreErr) {
                    console.error('[PaymentController] resolveDebt: Failed to check auto-restore:', restoreErr);
                }
            }, 500);

            res.json({
                success: true,
                message: 'Hutang berhasil diselesaikan',
                debt_amount: debtAmount
            });

        } catch (error) {
            await conn.rollback();
            console.error('Error resolving debt:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menyelesaikan hutang'
            });
        } finally {
            conn.release();
        }
    }

    /**
     * Upload payment proof
     */
    async uploadPaymentProof(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { proof_image_url } = req.body;

            // TODO: Handle file upload using multer
            // For now, just accept image URL

            await databasePool.execute(`
                INSERT INTO payment_proofs (
                    payment_id, image_url, uploaded_at
                ) VALUES (?, ?, NOW())
            `, [id, proof_image_url]);

            res.json({
                success: true,
                message: 'Bukti pembayaran berhasil diupload'
            });

        } catch (error) {
            console.error('Error uploading payment proof:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal upload bukti pembayaran'
            });
        }
    }

    /**
     * Process payment via gateway (Xendit, Mitra, Tripay)
     */
    async processGatewayPayment(req: Request, res: Response): Promise<void> {
        try {
            const {
                invoice_id,
                customer_id,
                gateway_code,
                payment_method,
                callback_url,
                redirect_url
            } = req.body;

            if (!invoice_id || !customer_id || !gateway_code || !payment_method) {
                res.status(400).json({
                    success: false,
                    message: 'Data tidak lengkap'
                });
                return;
            }

            // Create payment via gateway
            const result = await this.billingPaymentService.createInvoicePayment({
                invoiceId: parseInt(invoice_id),
                customerId: parseInt(customer_id),
                gatewayCode: gateway_code,
                paymentMethod: payment_method,
                callbackUrl: callback_url,
                redirectUrl: redirect_url
            });

            res.json(result);

        } catch (error: any) {
            console.error('Error processing gateway payment:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memproses pembayaran via gateway',
                error: error.message
            });
        }
    }

    /**
     * Unified Payment Processor for Admin
     * Supports multi-invoice selection, partial payments, and discounts.
     */
    async processPayment(req: Request, res: Response): Promise<void> {
        console.log(`[PaymentController] ðŸ’° Handling processPayment request from ${req.ip} for invoice ${req.body.invoice_id}`);
        try {
            const {
                invoice_id,
                selectedInvoiceIds,
                payment_amount,
                payment_method,
                payment_type,
                notes,
                discount_amount,
                discount_reason,
                sla_discount_amount,
                manual_discount_value,
                manual_discount_type,
                janji_bayar_date
            } = req.body;

            if (!invoice_id || !payment_method) {
                res.status(400).json({ success: false, message: 'Data tidak lengkap' });
                return;
            }

            // Get customer ID from primary invoice
            const [invoiceRows] = await databasePool.query<RowDataPacket[]>(
                'SELECT customer_id FROM invoices WHERE id = ?',
                [invoice_id]
            );

            if (invoiceRows.length === 0) {
                res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
                return;
            }

            const customerId = invoiceRows[0].customer_id;
            const kasirName = (req.session as any)?.username || 'admin';

            // Convert selectedInvoiceIds to numbers if present
            const invoiceIds = selectedInvoiceIds ? (Array.isArray(selectedInvoiceIds) ? selectedInvoiceIds.map(Number) : [Number(selectedInvoiceIds)]) : [Number(invoice_id)];

            const result = await this.processPaymentTransaction({
                customerId,
                amount: parseFloat(payment_amount || '0'),
                paymentMethod: payment_method,
                paymentType: payment_type,
                selectedInvoiceIds: invoiceIds,
                notes,
                kasirName,
                discountAmount: parseFloat(discount_amount || '0'),
                discountReason: discount_reason,
                slaDiscountAmount: parseFloat(sla_discount_amount || '0'),
                manualDiscountValue: parseFloat(manual_discount_value || '0'),
                manualDiscountType: manual_discount_type,
                dueDate: janji_bayar_date || null
            });

            res.json(result);

        } catch (error: any) {
            console.error('Error in processPayment:', error);
            const fs = require('fs');
            fs.appendFileSync('logs/debug_payment.log', `[${new Date().toISOString()}] processPayment Error: ${error.message}\n${error.stack}\n\n`);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    private async processPaymentTransaction(params: {
        customerId: number,
        amount: number,
        paymentMethod: string,
        selectedInvoiceIds: number[],
        paymentType?: string,
        notes?: string,
        kasirName?: string,
        discountAmount?: number,
        discountReason?: string,
        slaDiscountAmount?: number,
        manualDiscountValue?: number,
        manualDiscountType?: string,
        dueDate?: string
    }) {
        const conn = await databasePool.getConnection();
        try {
            await conn.beginTransaction();

            const {
                customerId,
                amount,
                paymentMethod,
                paymentType,
                selectedInvoiceIds,
                notes,
                kasirName,
                discountAmount = 0,
                discountReason = '',
                slaDiscountAmount = 0,
                manualDiscountValue = 0,
                manualDiscountType = 'manual',
                dueDate
            } = params;

            // 1. Fetch the target invoices
            const [invoices] = await conn.query<RowDataPacket[]>(
                `SELECT * FROM invoices 
                 WHERE id IN (?) AND customer_id = ? AND status != 'paid' 
                 ORDER BY period ASC`,
                [selectedInvoiceIds, customerId]
            );

            if (invoices.length === 0) {
                throw new Error('Tidak ada invoice valid yang terpilih');
            }

            let remainingPool = amount;
            let totalDiscountRemaining = discountAmount;
            const paymentDateStr = new Date().toISOString().slice(0, 10);

            let firstPaymentId = null;
            for (const inv of invoices) {
                const invId = inv.id;
                const invPeriod = inv.period;
                let invRemaining = parseFloat(inv.remaining_amount);
                
                // Determine how much discount to apply to this invoice
                // For administrative simplicity, we apply full discount to the FIRST invoice in the selected list (usually current or oldest)
                // but we could also split it. For now, let's keep it robust.
                let invDiscount = 0;
                if (totalDiscountRemaining > 0) {
                    invDiscount = Math.min(invRemaining, totalDiscountRemaining);
                    totalDiscountRemaining -= invDiscount;
                    invRemaining -= invDiscount;

                    // Record discount if it's the primary invoice or split proportionally
                    // For Admin, we carry over the detailed reasons if it was the primary one
                    if (invDiscount > 0) {
                        const finalSla = Math.min(invDiscount, slaDiscountAmount);
                        const finalManual = invDiscount - finalSla;

                        if (finalSla > 0) {
                            await conn.execute(
                                'INSERT INTO discounts (invoice_id, discount_type, discount_value, reason, created_at) VALUES (?, "sla", ?, "Kompensasi SLA", NOW())',
                                [invId, finalSla]
                            );
                        }
                        if (finalManual > 0) {
                            await conn.execute(
                                'INSERT INTO discounts (invoice_id, discount_type, discount_value, reason, created_at) VALUES (?, ?, ?, ?, NOW())',
                                [invId, manualDiscountType, finalManual, discountReason || 'Diskon Manual']
                            );
                        }
                    }
                }

                // Determine how much cash to apply
                const invPayment = Math.min(invRemaining, remainingPool);
                remainingPool -= invPayment;

                if (invPayment > 0 || invDiscount > 0 || paymentType === 'debt' || paymentType === 'janji_bayar') {
                    // Record payment ONLY if actual cash was spent
                    if (invPayment > 0) {
                        const defaultNotes = 'Pembayaran Kasir';
                        const [pResult] = await conn.execute<ResultSetHeader>(
                            'INSERT INTO payments (invoice_id, payment_method, amount, payment_date, gateway_status, notes, kasir_name, created_at) VALUES (?, ?, ?, ?, "completed", ?, ?, NOW())',
                            [invId, paymentMethod, invPayment, paymentDateStr, notes || defaultNotes, kasirName]
                        );
                        if (!firstPaymentId) firstPaymentId = pResult.insertId;
                    }

                    // Update invoice
                    const newPaid = parseFloat(inv.paid_amount) + invPayment;
                    const newDiscount = parseFloat(inv.discount_amount || 0) + invDiscount;
                    const newRemaining = Math.max(0, parseFloat(inv.remaining_amount) - invPayment - invDiscount);
                    
                    let newStatus = inv.status;
                    if (newRemaining <= 0) {
                        newStatus = 'paid';
                    } else if (newRemaining < parseFloat(inv.total_amount)) {
                        newStatus = 'partial';
                    }

                    if (paymentType === 'debt' && newRemaining > 0) {
                        // Do not set hutang immediately, wait for WA confirmation
                        if (newPaid > 0) {
                            newStatus = 'partial';
                        } else if (new Date(inv.due_date) < new Date()) {
                            newStatus = 'overdue';
                        } else {
                            newStatus = 'sent';
                        }
                    } else if (paymentType === 'janji_bayar' && newRemaining > 0) {
                        // Do not set janji_bayar immediately, wait for WA confirmation
                        if (newPaid > 0) {
                            newStatus = 'partial';
                        } else if (new Date(inv.due_date) < new Date()) {
                            newStatus = 'overdue';
                        } else {
                            newStatus = 'sent';
                        }
                    }

                    await conn.execute(
                        `UPDATE invoices SET 
                            paid_amount = ?, 
                            discount_amount = ?, 
                            remaining_amount = ?, 
                            status = ?, 
                            last_payment_date = ?,
                            updated_at = NOW() 
                         WHERE id = ?`,
                        [newPaid, newDiscount, newRemaining, newStatus, paymentDateStr, invId]
                    );

                    // Sync debt tracking
                    if (newStatus === 'paid') {
                        await conn.execute(
                            "UPDATE debt_tracking SET status = 'resolved', resolved_at = NOW() WHERE invoice_id = ?",
                            [invId]
                        );
                    } else if (paymentType === 'debt' || paymentType === 'janji_bayar') {
                        // Insert into payment_confirmations instead of processing debt tracking directly
                        await conn.query(`
                            INSERT INTO payment_confirmations (customer_id, invoice_id, amount, type, status, due_date, notes, kasir_name, created_at, updated_at)
                            VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NOW(), NOW())
                        `, [customerId, invId, newRemaining, paymentType, dueDate || null, notes || 'Dilakukan via System', kasirName]);

                        // Send WA confirmation
                        try {
                            const [custData] = await conn.query<RowDataPacket[]>(
                                'SELECT c.name, c.phone, i.due_date as inv_due FROM customers c JOIN invoices i ON c.id = i.customer_id WHERE c.id = ? AND i.id = ?', 
                                [customerId, invId]
                            );
                            if (custData.length > 0 && custData[0].phone) {
                                const { WhatsAppService } = await import('../../services/whatsapp/WhatsAppService');
                                const waService = WhatsAppService.getInstance();
                                let phone = custData[0].phone.replace(/^0/, '62').replace(/\D/g, '');
                                const typeName = paymentType === 'janji_bayar' ? 'Janji Bayar' : 'Hutang';
                                
                                // Format the requested Janji Bayar due date
                                const requestedDueTxt = dueDate ? `\n\nTanggal Janji Bayar yang diminta: *${new Date(dueDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}*` : '';
                                
                                // Format the original isolation date (invoice.due_date + 1 day)
                                let isolirTxt = 'sesuai jadwal tunggakan awal';
                                if (custData[0].inv_due) {
                                    const isoDate = new Date(custData[0].inv_due);
                                    isoDate.setDate(isoDate.getDate() + 1);
                                    isolirTxt = `pada tanggal *${isoDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}* (karena batas akhir tagihan awal adalah ${new Date(custData[0].inv_due).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})`;
                                }

                                const confirmMsg = `Halo *${custData[0].name}*,\n\nAdmin kami telah mencatat permohonan *${typeName}* Anda untuk tagihan internet sebesar *Rp ${newRemaining.toLocaleString('id-ID')}*.${requestedDueTxt}\n\n*PENTING (MOHON DIBACA):*\nUntuk menyetujui kesepakatan ini dan mencegah pemblokiran/isolir koneksi internet Anda, silakan balas pesan ini dengan mengetik:\n\n*SETUJU*\n\n_(Jika Anda tidak membalas SETUJU, maka permohonan tidak akan aktif dan koneksi Anda akan diisolir ${isolirTxt})_.`;
                                await waService.sendMessage(phone + '@s.whatsapp.net', confirmMsg);
                            }
                        } catch (notifErr) {
                            console.error('[PaymentController] Failed to send WA confirmation:', notifErr);
                        }
                    }
                }
            }

            // 3. Handle leftover balance if any (only for non-postpaid)
            if (remainingPool > 0) {
                const [cust] = await conn.query<RowDataPacket[]>(
                    'SELECT billing_mode FROM customers WHERE id = ?', [customerId]
                );
                if (cust.length > 0 && cust[0].billing_mode !== 'postpaid') {
                    await conn.execute(
                        'UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?',
                        [remainingPool, customerId]
                    );
                    await conn.execute(
                        'INSERT INTO customer_balance_logs (customer_id, type, amount, description, created_at) VALUES (?, "credit", ?, ?, NOW())',
                        [customerId, remainingPool, 'Kelebihan pembayaran (Multi-Invoice)']
                    );
                }
            }

            await conn.commit();

            if (firstPaymentId || paymentType === 'janji_bayar' || paymentType === 'debt') {
                import('../../services/notification/UnifiedNotificationService').then(({ UnifiedNotificationService }) => {
                    if (firstPaymentId) {
                        // Send Regular/Partial receipt to customer
                        UnifiedNotificationService.notifyPaymentReceived(firstPaymentId, true, true)
                            .catch(err => console.error('[AdminPayment] Failed to send customer receipt:', err));
                    }

                    // Admin Broadcast (No need to broadcast customer notifications if we wait for WA reply)
                    if (paymentType === 'debt' || paymentType === 'janji_bayar') {
                        const typeLabel = paymentType === 'janji_bayar' ? 'JANJI BAYAR' : 'HUTANG';
                        const dateInfo = (dueDate && !isNaN(Date.parse(dueDate))) ? `ðŸ“† *Tgl Janji:* ${new Date(dueDate).toLocaleDateString('id-ID')}\n` : '';
                        
                        UnifiedNotificationService.broadcastToAdmins(
                            `ðŸ“Œ *INFORMASI ${typeLabel} BARU (ADMIN)*\n\n` +
                            `ðŸ‘¤ *Pelanggan ID:* ${customerId}\n` +
                            `ðŸ§¾ *Invoices:* ${selectedInvoiceIds.join(', ')}\n` +
                            `ðŸ’° *Sisa Tagihan:* Rp ${amount.toLocaleString('id-ID')}\n` +
                            dateInfo +
                            `ðŸ“ *Keterangan:* Status diupdate via Admin Panel.\n\n` +
                            `Mohon pimpinan (Nina/Diki) untuk memantau status ini.`
                        ).catch(notifErr => console.error('[AdminPayment] Failed to notify admins about status change:', notifErr));

                        // [Fix] Auto-Regenerate Next Period Invoice if already created
                        // This ensures 'tunggakan' appears in the new invoice!
                        if (selectedInvoiceIds.length > 0) {
                            setTimeout(async () => {
                                try {
                                    const { InvoiceService } = await import('../../services/billing/invoiceService');
                                    // Make our own temporary connection pool
                                    const { databasePool } = await import('../../db/pool');
                                    
                                    const [invs]: any = await databasePool.query('SELECT period FROM invoices WHERE id = ?', [selectedInvoiceIds[0]]);
                                    if (invs && invs.length > 0) {
                                        const currentPeriod = invs[0].period;
                                        const [year, month] = currentPeriod.split('-').map(Number);
                                        let nextYear = year;
                                        let nextMonth = month + 1;
                                        if (nextMonth > 12) {
                                            nextYear++;
                                            nextMonth = 1;
                                        }
                                        const nextPeriod = `${nextYear}-${nextMonth.toString().padStart(2, '0')}`;
                                        
                                        const [nextInvs]: any = await databasePool.query(
                                            "SELECT id, status FROM invoices WHERE customer_id = ? AND period = ?", 
                                            [customerId, nextPeriod]
                                        );
                                        
                                        // If next month invoice exists and is unpaid, rebuild it
                                        if (nextInvs && nextInvs.length > 0) {
                                            if (nextInvs[0].status === 'sent') {
                                                console.log(`[AutoRegen] Next invoice ${nextPeriod} already exists. Deleting & Rebuilding to include the new debt...`);
                                                // Delete it cleanly
                                                await InvoiceService.bulkDeleteInvoices([nextInvs[0].id]);
                                                // Regenerate!
                                                await InvoiceService.generateMonthlyInvoices(nextPeriod, [customerId], true);
                                                console.log(`[AutoRegen] âœ… Regenerated next invoice ${nextPeriod} for customer ${customerId}`);
                                            }
                                        }
                                    }
                                } catch (e) { console.error('[AutoRegen] Error dynamically reconstructing next invoice:', e); }
                            }, 2000); // give it 2 seconds
                        }
                    }
                }).catch(err => console.error('[AdminPayment] Error importing notification service:', err));
            }

            // 5. Auto-restore trigger (Non-blocking)
            // Release connection first, then run restore check in background with a new connection
            conn.release();
            
            setTimeout(() => {
                IsolationService.restoreIfQualified(customerId).catch(e => {
                    console.warn('Auto-restore background failed:', (e as any).message);
                });
            }, 500);

            return { 
                success: true, 
                message: 'Pembayaran berhasil diproses selektif',
                paymentId: firstPaymentId
            };

        } catch (error: any) {
            if (conn) await conn.rollback();
            if (conn) conn.release();
            throw error;
        }
    }
}

