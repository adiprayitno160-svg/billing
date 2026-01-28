import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { BillingPaymentIntegration } from '../../services/payment/BillingPaymentIntegration';
import { PaymentGatewayService } from '../../services/payment/PaymentGatewayService';
import SLAMonitoringService from '../../services/slaMonitoringService';

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

            // 1. Queue notification again
            await UnifiedNotificationService.notifyPaymentReceived(paymentId);

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
            const date_from = req.query.date_from as string || '';
            const date_to = req.query.date_to as string || '';
            const format = req.query.format as string || '';

            const offset = (page - 1) * limit;

            // Build query conditions
            const whereConditions: string[] = [];
            const queryParams: any[] = [];

            if (customer_id) {
                whereConditions.push('i.customer_id = ?');
                queryParams.push(customer_id);
            }

            if (payment_method) {
                whereConditions.push('p.payment_method = ?');
                queryParams.push(payment_method);
            }

            if (date_from) {
                whereConditions.push('DATE(p.payment_date) >= ?');
                queryParams.push(date_from);
            }

            if (date_to) {
                whereConditions.push('DATE(p.payment_date) <= ?');
                queryParams.push(date_to);
            }

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
                    i.invoice_number,
                    i.period,
                    i.customer_id,
                    i.status as invoice_status,
                    i.total_amount as invoice_total,
                    i.paid_amount as invoice_paid,
                    i.remaining_amount as invoice_remaining
                FROM payments p
                LEFT JOIN invoices i ON p.invoice_id = i.id
                LEFT JOIN customers c ON i.customer_id = c.id
                ${whereClause}
                ORDER BY p.payment_date DESC, p.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) AS total
                FROM payments p
                LEFT JOIN invoices i ON p.invoice_id = i.id
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
                    SUM(amount) as total_amount,
                    SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END) as cash_amount,
                    SUM(CASE WHEN payment_method = 'transfer' THEN amount ELSE 0 END) as transfer_amount,
                    SUM(CASE WHEN payment_method = 'gateway' THEN amount ELSE 0 END) as gateway_amount
                FROM payments
                LEFT JOIN invoices i ON payments.invoice_id = i.id
                ${whereClause}
            `;

            const [statsResult] = await databasePool.query(statsQuery, queryParams);
            const stats = (statsResult as RowDataPacket[])[0];

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
                        date_to
                    }
                });
                return;
            }

            // Otherwise render view
            res.render('billing/payments', {
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
                    date_to
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
                            invoice_id, discount_type, amount, percentage, reason, created_at
                        ) VALUES (?, 'sla', ?, ?, 'Kompensasi SLA', NOW())
                    `, [invoice_id, slaDiscountAmount, req.body.sla_discount_percentage || 0]);
                }

                // Manual Discount
                if (manualDiscountAmount > 0) {
                    // Check if not included in SLA (to avoid double counting if logic changes)
                    // Here we assume total discount = sla + manual
                    await conn.execute(`
                        INSERT INTO discounts (
                            invoice_id, discount_type, amount, reason, created_at
                        ) VALUES (?, 'manual', ?, ?, NOW())
                    `, [invoice_id, manualDiscountAmount, discountReason || 'Diskon Manual']);
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

            const updateInvoiceQuery = `
                UPDATE invoices 
                SET 
                    paid_amount = ?,
                    discount_amount = ?,
                    remaining_amount = 0,
                    status = 'paid',
                    last_payment_date = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;

            await conn.execute(updateInvoiceQuery, [
                newPaidTotal,
                newDiscountTotal,
                paymentDateStr,
                invoice_id
            ]);

            // Resolve any active debts for this invoice
            await conn.execute(`
                UPDATE debt_tracking 
                SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
                WHERE invoice_id = ? AND status = 'active'
            `, [invoice_id]);

            await conn.commit();

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
                    UnifiedNotificationService.notifyPaymentReceived((paymentRows[0] as any).id).catch(e =>
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
                            invoice_id, discount_type, amount, percentage, reason, created_at
                        ) VALUES (?, 'sla', ?, ?, 'Kompensasi SLA', NOW())
                    `, [invoice_id, slaDiscountAmount, req.body.sla_discount_percentage || 0]);
                }

                // Manual Discount
                if (manualDiscountAmount > 0) {
                    await conn.execute(`
                        INSERT INTO discounts (
                            invoice_id, discount_type, amount, reason, created_at
                        ) VALUES (?, 'manual', ?, ?, NOW())
                    `, [invoice_id, manualDiscountAmount, discountReason || 'Diskon Manual']);
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

            // We also need to update total_amount if we treat discount as reduction of bill?
            // Or just track it in discount_amount?
            // If we increase discount_amount, we should probably decrease total_amount?
            // "total_amount" = subtotal - discount_amount.
            // So yes.

            const newTotalAmount = parseFloat(invoice.subtotal) - newDiscountTotal;

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
                // Create debt record
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

            await conn.commit();

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
                    UnifiedNotificationService.notifyPaymentReceived((paymentRows[0] as any).id).catch(e =>
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

            // Create debt record
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

            // Update invoice status to 'partial' (bukan overdue, karena ini kesepakatan hutang)
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

                    console.log(`[PaymentController] ðŸ“± Sending debt notification to customer ${customer.name}...`);

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

                    console.log(`[PaymentController] âœ… Debt notification queued (IDs: ${notificationIds.join(', ')})`);
                } else {
                    console.log(`[PaymentController] âš ï¸ No phone number for customer ${invoice.customer_id}, skipping notification`);
                }
            } catch (notifError: any) {
                console.error(`[PaymentController] âš ï¸ Failed to send debt notification (non-critical):`, notifError.message);
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
            const status = req.query.status as string || 'active';
            const customer_id = req.query.customer_id as string || '';

            const offset = (page - 1) * limit;

            // Build query conditions
            const whereConditions: string[] = ['dt.status = ?'];
            const queryParams: any[] = [status];

            if (customer_id) {
                whereConditions.push('dt.customer_id = ?');
                queryParams.push(customer_id);
            }

            const whereClause = 'WHERE ' + whereConditions.join(' AND ');

            // Get debts
            const debtsQuery = `
                SELECT 
                    dt.*,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone as customer_phone,
                    i.invoice_number,
                    i.period,
                    i.total_amount as invoice_total,
                    DATEDIFF(CURRENT_DATE, dt.debt_date) as days_overdue
                FROM debt_tracking dt
                LEFT JOIN customers c ON dt.customer_id = c.id
                LEFT JOIN invoices i ON dt.invoice_id = i.id
                ${whereClause}
                ORDER BY dt.debt_date DESC, dt.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) AS total
                FROM debt_tracking dt
                ${whereClause}
            `;

            const [debtsResult, countResult] = await Promise.all([
                databasePool.query(debtsQuery, [...queryParams, limit, offset]),
                databasePool.query(countQuery, queryParams)
            ]);

            const debts = debtsResult[0] as RowDataPacket[];
            const totalCount = (countResult[0] as RowDataPacket[])[0]?.total ?? 0;
            const totalPages = Math.ceil(totalCount / limit);

            // Get statistics
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_debts,
                    SUM(debt_amount) as total_debt_amount,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_debts,
                    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_debts
                FROM debt_tracking
            `;

            const [statsResult] = await databasePool.query(statsQuery);
            const stats = (statsResult as RowDataPacket[])[0];

            // Check if JSON format is requested
            const format = req.query.format as string || '';
            if (format === 'json') {
                res.json({
                    success: true,
                    debts,
                    stats,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalCount,
                        limit
                    },
                    filters: {
                        status,
                        customer_id
                    }
                });
                return;
            }

            res.render('billing/debt-tracking', {
                title: 'Pelacakan Hutang',
                debts,
                stats,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit
                },
                filters: {
                    status,
                    customer_id
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

            const { id } = req.params;
            const { payment_method, reference_number, notes } = req.body;

            // Get debt info
            const [debtResult] = await conn.query<RowDataPacket[]>(`
                SELECT dt.*, i.remaining_amount as invoice_remaining
                FROM debt_tracking dt
                JOIN invoices i ON dt.invoice_id = i.id
                WHERE dt.id = ?
            `, [id]);

            const debt = debtResult[0];

            if (!debt) {
                res.status(404).json({
                    success: false,
                    message: 'Hutang tidak ditemukan'
                });
                await conn.rollback();
                return;
            }

            if (debt.status === 'resolved') {
                res.status(400).json({
                    success: false,
                    message: 'Hutang sudah diselesaikan'
                });
                await conn.rollback();
                return;
            }

            const debtAmount = parseFloat(debt.debt_amount);

            // Create payment record
            const paymentInsertQuery = `
                INSERT INTO payments (
                    invoice_id, payment_method, amount, payment_date,
                    reference_number, notes, created_at
                ) VALUES (?, ?, ?, NOW(), ?, ?, NOW())
            `;

            await conn.execute(paymentInsertQuery, [
                debt.invoice_id,
                payment_method || 'cash',
                debtAmount,
                reference_number || null,
                notes || `Pelunasan hutang - ${debt.debt_reason}`
            ]);

            // Mark debt as resolved
            await conn.execute(`
                UPDATE debt_tracking 
                SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
                WHERE id = ?
            `, [id]);

            // Update invoice if this resolves all debt
            const [invoiceResult] = await conn.query<RowDataPacket[]>(`
                SELECT * FROM invoices WHERE id = ?
            `, [debt.invoice_id]);

            const invoice = invoiceResult[0];

            if (invoice) {
                const newPaidAmount = parseFloat(invoice.paid_amount) + debtAmount;
                const newRemainingAmount = parseFloat(invoice.total_amount) - newPaidAmount;

                let newStatus = invoice.status;
                if (newRemainingAmount <= 0.01) {
                    newStatus = 'paid';
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
                `, [newPaidAmount, newRemainingAmount, newStatus, debt.invoice_id]);
            }

            await conn.commit();

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
     * Get payment form with gateway options
     */
    async getPaymentForm(req: Request, res: Response): Promise<void> {
        try {
            const { invoiceId } = req.params;

            // Get invoice details
            const [invoiceResult] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone as customer_phone,
                    c.email as customer_email
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `, [invoiceId]);

            const invoice = invoiceResult[0];

            if (!invoice) {
                res.status(404).render('error', {
                    title: 'Error',
                    message: 'Invoice tidak ditemukan'
                });
                return;
            }

            // Get available payment gateways
            const [gateways] = await databasePool.query<RowDataPacket[]>(`
                SELECT id, name, code, is_active, config, created_at, updated_at FROM payment_gateways WHERE is_active = 1
            `);

            // Get payment methods for customer
            const availableMethods = await this.billingPaymentService.getAvailablePaymentMethods(
                invoice.customer_id
            );

            // --- SLA Discount Logic ---
            let slaDiscount = null;
            try {
                // Determine period date from invoice
                let periodDate = new Date();
                if (invoice.period && /^\d{4}-\d{2}$/.test(invoice.period)) {
                    const parts = invoice.period.split('-');
                    // Create date: Year, Month (0-indexed), Day 1
                    periodDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
                } else if (invoice.created_at) {
                    periodDate = new Date(invoice.created_at);
                    periodDate.setDate(1); // Force to start of month
                }

                // Use ensureSLARecord to calculate on the fly if missing (e.g. new month)
                const slaRecord = await SLAMonitoringService.ensureSLARecord(invoice.customer_id, periodDate);

                if (slaRecord) {
                    // Check if SLA criteria is met
                    const isSlaMet = slaRecord.sla_percentage >= slaRecord.sla_target;

                    // Calculate effective discount percentage based on amount
                    // Calculate effective discount percentage based on amount
                    let discountPercent = Number(slaRecord.sla_target) - Number(slaRecord.sla_percentage);
                    if (discountPercent < 0) discountPercent = 0;

                    // Use values from record if available, otherwise estimate
                    const discountAmount = Number(slaRecord.discount_amount || 0);

                    slaDiscount = {
                        applicable: true,
                        sla_target: parseFloat(String(slaRecord.sla_target || 99.0)),
                        uptime_percentage: parseFloat(String(slaRecord.sla_percentage || 100)),
                        total_downtime_minutes: parseInt(String(slaRecord.downtime_minutes || 0)),
                        incident_count: parseInt(String(slaRecord.incident_count || 0)),
                        discount_amount: discountAmount,
                        discount_percentage: discountPercent,
                        sla_met: isSlaMet
                    };

                    console.log(`[PaymentController] SLA Info for Invoice ${invoiceId}:`, slaDiscount);
                } else {
                    console.log(`[PaymentController] No SLA record found for customer ${invoice.customer_id} period ${periodDate.toISOString().slice(0, 7)}`);
                    // Create default object to trigger "Unavailable" view state
                    slaDiscount = {
                        applicable: false, // This will trigger the 'else' block in the view
                        sla_target: 0,
                        uptime_percentage: 0,
                        total_downtime_minutes: 0,
                        incident_count: 0,
                        discount_amount: 0,
                        discount_percentage: 0,
                        sla_met: false
                    };
                }
            } catch (slaError) {
                console.error('Error fetching SLA info for payment form:', slaError);
                // Even on error, pass empty object so the view doesn't crash
                slaDiscount = { applicable: false };
            }

            res.render('billing/payment-form', {
                title: 'Form Pembayaran',
                invoice,
                gateways,
                availableMethods,
                slaDiscount
            });

        } catch (error) {
            console.error('Error getting payment form:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat form pembayaran'
            });
        }
    }

}
