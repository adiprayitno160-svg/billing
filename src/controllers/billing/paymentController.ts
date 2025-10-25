import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { BillingPaymentIntegration } from '../../services/payment/BillingPaymentIntegration';
import { PaymentGatewayService } from '../../services/payment/PaymentGatewayService';
import { WhatsAppWebService } from '../../services/whatsapp/WhatsAppWebService';

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
                SELECT * FROM invoices WHERE id = ?
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
                remainingAmount,
                paymentDateStr,
                reference_number || null,
                notes || null
            ]);

            // Update invoice - LUNAS
            const updateInvoiceQuery = `
                UPDATE invoices 
                SET 
                    paid_amount = total_amount,
                    remaining_amount = 0,
                    status = 'paid',
                    last_payment_date = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;

            await conn.execute(updateInvoiceQuery, [paymentDateStr, invoice_id]);

            // Resolve any active debts for this invoice
            await conn.execute(`
                UPDATE debt_tracking 
                SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
                WHERE invoice_id = ? AND status = 'active'
            `, [invoice_id]);

            await conn.commit();

            // Release connection first before sending notification
            conn.release();

            // Send WhatsApp notification (non-blocking, don't fail payment if notification fails)
            const discountAmount = req.body.discount_amount || 0;
            this.sendPaymentWhatsAppNotification(invoice, 'full', remainingAmount, discountAmount).catch(err => {
                console.error('WhatsApp notification failed (non-critical):', err);
            });

            res.json({
                success: true,
                message: 'Pembayaran penuh berhasil diproses',
                payment_amount: remainingAmount,
                invoice_status: 'paid'
            });

        } catch (error) {
            await conn.rollback();
            conn.release();
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
                SELECT * FROM invoices WHERE id = ?
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

            if (paymentAmountFloat > remainingAmount) {
                res.status(400).json({
                    success: false,
                    message: 'Jumlah pembayaran melebihi sisa tagihan'
                });
                await conn.rollback();
                return;
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
                paymentAmountFloat,
                paymentDateStr,
                reference_number || null,
                notes || null
            ]);

            // Calculate new paid and remaining amounts
            const newPaidAmount = parseFloat(invoice.paid_amount) + paymentAmountFloat;
            const newRemainingAmount = parseFloat(invoice.total_amount) - newPaidAmount;

            // Determine new status
            let newStatus = 'partial';
            if (newRemainingAmount <= 0.01) { // Handle floating point precision
                newStatus = 'paid';
            }

            // Update invoice
            const updateInvoiceQuery = `
                UPDATE invoices 
                SET 
                    paid_amount = ?,
                    remaining_amount = ?,
                    status = ?,
                    last_payment_date = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;

            await conn.execute(updateInvoiceQuery, [
                newPaidAmount,
                newRemainingAmount,
                newStatus,
                paymentDateStr,
                invoice_id
            ]);

            // Create or update debt tracking
            const debtAmount = newRemainingAmount;
            
            if (debtAmount > 0) {
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
                    debtAmount,
                    paymentDateStr,
                    `Sisa pembayaran dari invoice ${invoice.invoice_number}`
                ]);
            }

            await conn.commit();

            // Release connection first before sending notification
            conn.release();

            // Send WhatsApp notification (non-blocking, don't fail payment if notification fails)
            const discountAmount = req.body.discount_amount || 0;
            this.sendPaymentWhatsAppNotification(invoice, 'partial', paymentAmountFloat, discountAmount).catch(err => {
                console.error('WhatsApp notification failed (non-critical):', err);
            });

            res.json({
                success: true,
                message: 'Pembayaran parsial berhasil diproses',
                payment_amount: paymentAmountFloat,
                remaining_amount: newRemainingAmount,
                invoice_status: newStatus
            });

        } catch (error) {
            await conn.rollback();
            conn.release();
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
                SELECT * FROM invoices WHERE id = ?
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

            // Send WhatsApp notification (non-blocking, don't fail payment if notification fails)
            const discountAmount = req.body.discount_amount || 0;
            this.sendPaymentWhatsAppNotification(invoice, 'debt', 0, discountAmount).catch(err => {
                console.error('WhatsApp notification failed (non-critical):', err);
            });

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
                SELECT * FROM payment_gateways WHERE is_active = 1
            `);

            // Get payment methods for customer
            const availableMethods = await this.billingPaymentService.getAvailablePaymentMethods(
                invoice.customer_id
            );

            res.render('billing/payment-form', {
                title: 'Form Pembayaran',
                invoice,
                gateways,
                availableMethods
            });

        } catch (error) {
            console.error('Error getting payment form:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat form pembayaran'
            });
        }
    }

    /**
     * Send WhatsApp payment notification
     */
    private async sendPaymentWhatsAppNotification(
        invoice: any,
        paymentType: 'full' | 'partial' | 'debt',
        paymentAmount: number,
        discountAmount?: number
    ): Promise<void> {
        try {
            // Get customer phone
            const [customerResult] = await databasePool.query<RowDataPacket[]>(`
                SELECT phone, name FROM customers WHERE id = ?
            `, [invoice.customer_id]);

            const customer = customerResult[0];
            if (!customer || !customer.phone) {
                console.log('Customer phone not found for WhatsApp notification');
                return;
            }

            // Format phone number to international format (62xxx)
            let phoneNumber = customer.phone.toString().trim();
            // Remove all non-numeric characters except +
            phoneNumber = phoneNumber.replace(/[^0-9+]/g, '');
            // Convert 08xx to 628xx
            if (phoneNumber.startsWith('08')) {
                phoneNumber = '62' + phoneNumber.substring(1);
            } else if (phoneNumber.startsWith('8')) {
                phoneNumber = '62' + phoneNumber;
            } else if (phoneNumber.startsWith('0')) {
                phoneNumber = '62' + phoneNumber.substring(1);
            } else if (!phoneNumber.startsWith('62') && !phoneNumber.startsWith('+62')) {
                phoneNumber = '62' + phoneNumber;
            }
            // Remove + if exists
            phoneNumber = phoneNumber.replace('+', '');

            console.log(`📱 Sending WhatsApp to ${phoneNumber} (original: ${customer.phone})`);

            let message = `Halo *${customer.name}*,\n\n`;

            if (paymentType === 'full') {
                message += `✅ *PEMBAYARAN LUNAS*\n\n`;
                message += `📋 *Detail Pembayaran:*\n`;
                message += `• No. Invoice: ${invoice.invoice_number}\n`;
                message += `• Periode: ${invoice.period}\n`;
                message += `• Total Tagihan: Rp ${parseFloat(invoice.total_amount).toLocaleString('id-ID')}\n`;
                if (discountAmount && discountAmount > 0) {
                    message += `• Diskon: Rp ${discountAmount.toLocaleString('id-ID')}\n`;
                    message += `• Dibayar: Rp ${paymentAmount.toLocaleString('id-ID')}\n`;
                } else {
                    message += `• Dibayar: Rp ${paymentAmount.toLocaleString('id-ID')}\n`;
                }
                message += `• Status: *LUNAS* ✅\n\n`;
                message += `🎉 Terima kasih atas pembayaran Anda! Tagihan sudah lunas.\n`;
            } else if (paymentType === 'partial') {
                const remaining = parseFloat(invoice.remaining_amount) - paymentAmount;
                message += `💵 *PEMBAYARAN CICILAN DITERIMA*\n\n`;
                message += `📋 *Detail Pembayaran:*\n`;
                message += `• No. Invoice: ${invoice.invoice_number}\n`;
                message += `• Periode: ${invoice.period}\n`;
                message += `• Total Tagihan: Rp ${parseFloat(invoice.total_amount).toLocaleString('id-ID')}\n`;
                if (discountAmount && discountAmount > 0) {
                    message += `• Diskon: Rp ${discountAmount.toLocaleString('id-ID')}\n`;
                }
                message += `• Dibayar Sekarang: Rp ${paymentAmount.toLocaleString('id-ID')}\n`;
                message += `• Sisa Tagihan: Rp ${remaining.toLocaleString('id-ID')}\n\n`;
                message += `⚠️ Mohon segera lunasi sisa pembayaran.\n`;
            } else if (paymentType === 'debt') {
                message += `📝 *HUTANG TERCATAT*\n\n`;
                message += `📋 *Detail:*\n`;
                message += `• No. Invoice: ${invoice.invoice_number}\n`;
                message += `• Periode: ${invoice.period}\n`;
                if (discountAmount && discountAmount > 0) {
                    message += `• Total Tagihan: Rp ${parseFloat(invoice.total_amount).toLocaleString('id-ID')}\n`;
                    message += `• Diskon: Rp ${discountAmount.toLocaleString('id-ID')}\n`;
                    message += `• Hutang Bersih: Rp ${(parseFloat(invoice.total_amount) - discountAmount).toLocaleString('id-ID')}\n\n`;
                } else {
                    message += `• Total Hutang: Rp ${parseFloat(invoice.total_amount).toLocaleString('id-ID')}\n\n`;
                }
                message += `⚠️ Pembayaran ditunda. Harap segera melunasi hutang.\n`;
            }

            message += `\nTerima kasih.`;

            // Send via WhatsApp Web Service
            await WhatsAppWebService.sendMessage(phoneNumber, message);

            console.log(`✅ WhatsApp payment notification sent to ${phoneNumber}`);

        } catch (error) {
            console.error('Error sending WhatsApp payment notification:', error);
            // Don't throw error - payment should succeed even if notification fails
        }
    }
}
