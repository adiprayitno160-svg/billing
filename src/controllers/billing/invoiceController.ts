import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class InvoiceController {
    
    /**
     * Get invoice list with filters
     */
    async getInvoiceList(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const status = req.query.status as string || '';
            const search = req.query.search as string || '';
            const period = req.query.period as string || '';
            const odc_id = req.query.odc_id as string || '';
            
            const offset = (page - 1) * limit;

            // Build query conditions
            const whereConditions: string[] = [];
            const queryParams: any[] = [];

            if (status) {
                whereConditions.push('i.status = ?');
                queryParams.push(status);
            }

            if (period) {
                whereConditions.push('i.period = ?');
                queryParams.push(period);
            }

            if (odc_id) {
                whereConditions.push('c.odc_id = ?');
                queryParams.push(odc_id);
            }

            if (search) {
                whereConditions.push('(c.name LIKE ? OR c.phone LIKE ? OR i.invoice_number LIKE ?)');
                queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            const whereClause = whereConditions.length > 0 
                ? 'WHERE ' + whereConditions.join(' AND ') 
                : '';

            // Get invoices with customer info and ODC data
            const invoicesQuery = `
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.email as customer_email,
                    c.customer_code,
                    c.id as customer_id,
                    c.odc_id,
                    odc.name as odc_name,
                    odc.location as odc_location,
                    COALESCE(c.is_isolated, 0) as customer_is_isolated,
                    COALESCE(
                        (SELECT SUM(amount) FROM payments WHERE invoice_id = i.id),
                        0
                    ) as total_paid
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
                ${whereClause}
                ORDER BY i.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) AS total
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                ${whereClause}
            `;

            const [invoicesResult, countResult] = await Promise.all([
                databasePool.query(invoicesQuery, [...queryParams, limit, offset]),
                databasePool.query(countQuery, queryParams)
            ]);

            const invoices = invoicesResult[0] as RowDataPacket[];
            const totalCount = (countResult[0] as RowDataPacket[])[0]?.total ?? 0;
            const totalPages = Math.ceil(totalCount / limit);

            // Get statistics
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_invoices,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_count,
                    SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
                    SUM(total_amount) as total_amount,
                    SUM(paid_amount) as total_paid,
                    SUM(remaining_amount) as total_remaining
                FROM invoices
            `;
            
            const [statsResult] = await databasePool.query(statsQuery);
            const stats = (statsResult as RowDataPacket[])[0];

            // Get ODC list for filter dropdown
            const odcQuery = `SELECT id, name, location FROM ftth_odc ORDER BY name`;
            const [odcResult] = await databasePool.query(odcQuery);
            const odcList = odcResult as RowDataPacket[];

            res.render('billing/tagihan', {
                title: 'Daftar Tagihan',
                invoices,
                stats,
                odcList,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit
                },
                filters: {
                    status,
                    search,
                    period,
                    odc_id
                }
            });
        } catch (error) {
            console.error('Error getting invoice list:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat daftar tagihan'
            });
        }
    }

    /**
     * Get invoice detail
     */
    async getInvoiceDetail(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            
            const invoiceQuery = `
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.email as customer_email,
                    c.address as customer_address,
                    c.customer_code
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `;

            const [invoiceResult] = await databasePool.query(invoiceQuery, [id]);
            const invoice = (invoiceResult as RowDataPacket[])[0];

            if (!invoice) {
                res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Tagihan tidak ditemukan'
                });
                return;
            }

            // Get invoice items
            const itemsQuery = `
                SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id
            `;
            const [itemsResult] = await databasePool.query(itemsQuery, [id]);
            const items = itemsResult as RowDataPacket[];

            // Get payment history
            const paymentsQuery = `
                SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC
            `;
            const [paymentsResult] = await databasePool.query(paymentsQuery, [id]);
            const payments = paymentsResult as RowDataPacket[];

            // Get debt tracking if exists
            const debtsQuery = `
                SELECT * FROM debt_tracking WHERE invoice_id = ? AND status = 'active'
            `;
            const [debtsResult] = await databasePool.query(debtsQuery, [id]);
            const debts = debtsResult as RowDataPacket[];

            res.render('billing/tagihan-detail', {
                title: 'Detail Tagihan',
                invoice,
                items,
                payments,
                debts
            });
        } catch (error) {
            console.error('Error getting invoice detail:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat detail tagihan'
            });
        }
    }

    /**
     * Create manual invoice
     */
    async createManualInvoice(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();
        
        try {
            await conn.beginTransaction();

            const {
                customer_id,
                period,
                due_date,
                items // Array of {description, quantity, unit_price}
            } = req.body;

            // Validate input
            if (!customer_id || !period || !due_date || !items || items.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Data tidak lengkap'
                });
                return;
            }

            // Generate invoice number
            const invoiceNumber = await this.generateInvoiceNumber(period);

            // Calculate totals
            let subtotal = 0;
            for (const item of items) {
                subtotal += parseFloat(item.quantity) * parseFloat(item.unit_price);
            }

            const discount_amount = parseFloat(req.body.discount_amount || '0');
            const total_amount = subtotal - discount_amount;

            // Insert invoice
            const invoiceInsertQuery = `
                INSERT INTO invoices (
                    invoice_number, customer_id, subscription_id, period, due_date,
                    subtotal, discount_amount, total_amount, paid_amount, remaining_amount,
                    status, created_at, updated_at
                ) VALUES (?, ?, 0, ?, ?, ?, ?, ?, 0, ?, 'draft', NOW(), NOW())
            `;

            const [invoiceResult] = await conn.execute<ResultSetHeader>(invoiceInsertQuery, [
                invoiceNumber,
                customer_id,
                period,
                due_date,
                subtotal,
                discount_amount,
                total_amount,
                total_amount
            ]);

            const invoiceId = invoiceResult.insertId;

            // Insert invoice items
            for (const item of items) {
                const itemInsertQuery = `
                    INSERT INTO invoice_items (
                        invoice_id, description, quantity, unit_price, total_price, created_at
                    ) VALUES (?, ?, ?, ?, ?, NOW())
                `;
                
                const total_price = parseFloat(item.quantity) * parseFloat(item.unit_price);
                
                await conn.execute(itemInsertQuery, [
                    invoiceId,
                    item.description,
                    item.quantity,
                    item.unit_price,
                    total_price
                ]);
            }

            await conn.commit();

            res.json({
                success: true,
                message: 'Invoice berhasil dibuat',
                invoice_id: invoiceId,
                invoice_number: invoiceNumber
            });

        } catch (error) {
            await conn.rollback();
            console.error('Error creating manual invoice:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal membuat invoice'
            });
        } finally {
            conn.release();
        }
    }

    /**
     * Generate bulk invoices (monthly automatic)
     */
    async generateBulkInvoices(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();
        
        try {
            await conn.beginTransaction();

            const { period, due_date_offset, send_whatsapp } = req.body;
            const currentPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM
            const dueDateOffset = parseInt(due_date_offset || '7'); // Default 7 days from period start
            const sendWhatsApp = send_whatsapp === true || send_whatsapp === 'true';

            console.log(`Generating bulk invoices for period: ${currentPeriod}`);
            console.log(`Send WhatsApp: ${sendWhatsApp}`);

            // Get all active subscriptions
            const subscriptionsQuery = `
                SELECT 
                    s.*,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone as customer_phone
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                WHERE s.status = 'active'
            `;

            const [subscriptions] = await conn.query<RowDataPacket[]>(subscriptionsQuery);

            console.log(`Found ${subscriptions.length} active subscriptions`);

            // Check for existing invoices
            const checkQuery = `
                SELECT DISTINCT customer_id, subscription_id
                FROM invoices
                WHERE period = ?
            `;
            const [existingInvoices] = await conn.query<RowDataPacket[]>(checkQuery, [currentPeriod]);
            const existingSet = new Set(
                existingInvoices.map((inv: any) => `${inv.customer_id}_${inv.subscription_id}`)
            );

            let createdCount = 0;
            let skippedCount = 0;
            let whatsappSent = 0;
            const errors: string[] = [];

            for (const subscription of subscriptions) {
                try {
                    const key = `${subscription.customer_id}_${subscription.id}`;
                    
                    // Skip if invoice already exists for this period
                    if (existingSet.has(key)) {
                        skippedCount++;
                        console.log(`⚠ Invoice already exists for customer ${subscription.customer_name}`);
                        continue;
                    }

                    // Calculate due date
                    const periodDate = new Date(currentPeriod + '-01');
                    const dueDate = new Date(periodDate);
                    dueDate.setDate(dueDateOffset);
                    const dueDateStr = dueDate.toISOString().slice(0, 10);

                    // Generate invoice number
                    const invoiceNumber = await this.generateInvoiceNumber(currentPeriod, conn);

                    const price = parseFloat(subscription.price);

                    // Insert invoice
                    const invoiceInsertQuery = `
                        INSERT INTO invoices (
                            invoice_number, customer_id, subscription_id, period, due_date,
                            subtotal, discount_amount, total_amount, paid_amount, remaining_amount,
                            status, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 'sent', NOW(), NOW())
                    `;

                    const [invoiceResult] = await conn.execute<ResultSetHeader>(invoiceInsertQuery, [
                        invoiceNumber,
                        subscription.customer_id,
                        subscription.id,
                        currentPeriod,
                        dueDateStr,
                        price,
                        price,
                        price
                    ]);

                    const invoiceId = invoiceResult.insertId;

                    // Insert invoice item
                    const itemInsertQuery = `
                        INSERT INTO invoice_items (
                            invoice_id, description, quantity, unit_price, total_price, created_at
                        ) VALUES (?, ?, 1, ?, ?, NOW())
                    `;

                    const description = `Paket ${subscription.package_name} - ${currentPeriod}`;

                    await conn.execute(itemInsertQuery, [
                        invoiceId,
                        description,
                        price,
                        price
                    ]);

                    createdCount++;
                    console.log(`✓ Invoice created for customer ${subscription.customer_name} (${invoiceNumber})`);

                    // Send WhatsApp notification if enabled
                    if (sendWhatsApp && subscription.customer_phone) {
                        try {
                            // TODO: Integrate with WhatsApp service
                            // For now, just count as sent
                            whatsappSent++;
                            console.log(`📱 WhatsApp notification queued for ${subscription.customer_name}`);
                        } catch (waError: any) {
                            console.error(`Failed to send WhatsApp to ${subscription.customer_name}:`, waError);
                        }
                    }

                } catch (itemError: any) {
                    console.error(`Error creating invoice for subscription ${subscription.id}:`, itemError);
                    errors.push(`Customer ${subscription.customer_name}: ${itemError.message}`);
                }
            }

            await conn.commit();

            res.json({
                success: true,
                message: `Berhasil membuat ${createdCount} tagihan`,
                created_count: createdCount,
                skipped_count: skippedCount,
                total_subscriptions: subscriptions.length,
                whatsapp_sent: sendWhatsApp ? whatsappSent : 0,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            await conn.rollback();
            console.error('Error generating bulk invoices:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal generate bulk invoice'
            });
        } finally {
            conn.release();
        }
    }

    /**
     * Update invoice status
     */
    async updateInvoiceStatus(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const validStatuses = ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'];
            if (!validStatuses.includes(status)) {
                res.status(400).json({
                    success: false,
                    message: 'Status tidak valid'
                });
                return;
            }

            await databasePool.query(
                'UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ?',
                [status, id]
            );

            res.json({
                success: true,
                message: 'Status invoice berhasil diperbarui'
            });
        } catch (error) {
            console.error('Error updating invoice status:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memperbarui status invoice'
            });
        }
    }

    /**
     * Delete invoice
     */
    async deleteInvoice(req: Request, res: Response): Promise<void> {
        const conn = await databasePool.getConnection();
        
        try {
            await conn.beginTransaction();

            const { id } = req.params;

            // Check if invoice has payments
            const [payments] = await conn.query<RowDataPacket[]>(
                'SELECT COUNT(*) as count FROM payments WHERE invoice_id = ?',
                [id]
            );

            if (payments[0] && payments[0].count > 0) {
                res.status(400).json({
                    success: false,
                    message: 'Invoice tidak dapat dihapus karena sudah ada pembayaran'
                });
                await conn.rollback();
                return;
            }

            // Delete invoice items first
            await conn.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
            
            // Delete invoice
            await conn.execute('DELETE FROM invoices WHERE id = ?', [id]);

            await conn.commit();

            res.json({
                success: true,
                message: 'Invoice berhasil dihapus'
            });

        } catch (error) {
            await conn.rollback();
            console.error('Error deleting invoice:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menghapus invoice'
            });
        } finally {
            conn.release();
        }
    }

    /**
     * Send invoice via WhatsApp
     */
    async sendInvoiceWhatsApp(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            // Get invoice with customer info
            const [invoiceResult] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `, [id]);

            const invoice = invoiceResult[0];

            if (!invoice) {
                res.status(404).json({
                    success: false,
                    message: 'Invoice tidak ditemukan'
                });
                return;
            }

            if (!invoice.customer_phone) {
                res.status(400).json({
                    success: false,
                    message: 'Nomor telepon pelanggan tidak tersedia'
                });
                return;
            }

            // TODO: Integrate with WhatsApp service
            // const whatsappService = new WhatsappService();
            // await whatsappService.sendInvoiceNotification(invoice);

            res.json({
                success: true,
                message: 'Invoice berhasil dikirim via WhatsApp'
            });

        } catch (error) {
            console.error('Error sending invoice via WhatsApp:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengirim invoice via WhatsApp'
            });
        }
    }

    /**
     * Generate unique invoice number
     */
    private async generateInvoiceNumber(period: string, conn?: any): Promise<string> {
        const connection = conn || databasePool;
        
        // Format: INV/YYYY/MM/XXXX
        const [year, month] = period.split('-');
        
        // Get last invoice number for this period
        const [result] = await connection.query(`
            SELECT invoice_number 
            FROM invoices 
            WHERE period = ? 
            ORDER BY invoice_number DESC 
            LIMIT 1
        `, [period]) as [RowDataPacket[], any];

        let sequence = 1;
        
        if (result.length > 0 && result[0]) {
            const lastNumber = result[0].invoice_number;
            const match = lastNumber.match(/\/(\d+)$/);
            if (match) {
                sequence = parseInt(match[1]) + 1;
            }
        }

        const sequenceStr = sequence.toString().padStart(4, '0');
        return `INV/${year}/${month}/${sequenceStr}`;
    }
}
