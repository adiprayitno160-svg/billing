"use strict";
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
exports.InvoiceController = void 0;
const pool_1 = require("../../db/pool");
class InvoiceController {
    /**
     * Get invoice list with filters
     */
    async getInvoiceList(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const status = req.query.status || '';
            const search = req.query.search || '';
            const period = req.query.period || '';
            const odc_id = req.query.odc_id || '';
            const offset = (page - 1) * limit;
            // Build query conditions
            const whereConditions = [];
            const queryParams = [];
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
                pool_1.databasePool.query(invoicesQuery, [...queryParams, limit, offset]),
                pool_1.databasePool.query(countQuery, queryParams)
            ]);
            const invoices = invoicesResult[0];
            const totalCount = countResult[0][0]?.total ?? 0;
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
            const [statsResult] = await pool_1.databasePool.query(statsQuery);
            const stats = statsResult[0];
            // Get ODC list for filter dropdown
            const odcQuery = `SELECT id, name, location FROM ftth_odc ORDER BY name`;
            const [odcResult] = await pool_1.databasePool.query(odcQuery);
            const odcList = odcResult;
            // Get scheduler settings for due_date_offset
            let dueDateOffset = 7; // default
            try {
                const [schedulerResult] = await pool_1.databasePool.query(`
                    SELECT id, task_name, is_enabled, cron_schedule, config, created_at, updated_at 
                    FROM scheduler_settings 
                    WHERE task_name = 'invoice_generation'
                    LIMIT 1
                `);
                if (schedulerResult && schedulerResult.length > 0) {
                    const row = schedulerResult[0];
                    if (row && row.config) {
                        const config = typeof row.config === 'string'
                            ? JSON.parse(row.config)
                            : row.config;
                        if (config && typeof config.due_date_offset === 'number') {
                            dueDateOffset = config.due_date_offset;
                        }
                    }
                }
            }
            catch (schedulerError) {
                // If scheduler_settings table doesn't exist or has issues, use default
                console.warn('Error getting scheduler settings (using default):', schedulerError.message);
            }
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
                },
                schedulerSettings: {
                    due_date_offset: dueDateOffset
                }
            });
        }
        catch (error) {
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
    async getInvoiceDetail(req, res) {
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
            const [invoiceResult] = await pool_1.databasePool.query(invoiceQuery, [id]);
            const invoice = invoiceResult[0];
            if (!invoice) {
                res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Tagihan tidak ditemukan'
                });
                return;
            }
            // Get invoice items
            const itemsQuery = `
                SELECT id, invoice_id, description, quantity, unit_price, total_price, created_at FROM invoice_items WHERE invoice_id = ? ORDER BY id
            `;
            const [itemsResult] = await pool_1.databasePool.query(itemsQuery, [id]);
            const items = itemsResult;
            // Get payment history
            const paymentsQuery = `
                SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC
            `;
            const [paymentsResult] = await pool_1.databasePool.query(paymentsQuery, [id]);
            const payments = paymentsResult;
            // Get debt tracking if exists
            const debtsQuery = `
                SELECT * FROM debt_tracking WHERE invoice_id = ? AND status = 'active'
            `;
            const [debtsResult] = await pool_1.databasePool.query(debtsQuery, [id]);
            const debts = debtsResult;
            res.render('billing/tagihan-detail', {
                title: 'Detail Tagihan',
                invoice,
                items,
                payments,
                debts
            });
        }
        catch (error) {
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
    async createManualInvoice(req, res) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.beginTransaction();
            const { customer_id, period, due_date, items // Array of {description, quantity, unit_price}
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
            const [invoiceResult] = await conn.execute(invoiceInsertQuery, [
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
        }
        catch (error) {
            await conn.rollback();
            console.error('Error creating manual invoice:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal membuat invoice'
            });
        }
        finally {
            conn.release();
        }
    }
    /**
     * Generate bulk invoices (monthly automatic)
     */
    async generateBulkInvoices(req, res) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.beginTransaction();
            const { period, due_date_offset } = req.body;
            const currentPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM
            const dueDateOffset = parseInt(due_date_offset || '7'); // Default 7 days from period start
            console.log(`Generating bulk invoices for period: ${currentPeriod}`);
            // Get all active customers with their subscriptions (if any)
            // This ensures we capture all active customers, not just those with active subscriptions
            const billingModeFilter = ''; // System is now postpaid only, no filter needed
            const subscriptionsQuery = `
                SELECT 
                    COALESCE(s.id, 0) as id,
                    c.id as customer_id,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone as customer_phone,
                    c.status as customer_status,
                    c.connection_type,
                    s.package_name,
                    COALESCE(s.price, 0) as price,
                    s.status as subscription_status,
                    s.start_date,
                    s.end_date
                FROM customers c
                LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                WHERE c.status = 'active'
                ${billingModeFilter}
                AND (c.connection_type = 'pppoe' OR c.connection_type = 'static_ip')
            `;
            const [subscriptions] = await conn.query(subscriptionsQuery);
            console.log(`Found ${subscriptions.length} active customers for billing`);
            // Log breakdown
            const withSubscription = subscriptions.filter((s) => s.id && s.id > 0).length;
            const withoutSubscription = subscriptions.length - withSubscription;
            console.log(`  - With active subscription: ${withSubscription}`);
            console.log(`  - Without subscription (will use default price): ${withoutSubscription}`);
            // Check for existing invoices - improved to handle NULL subscription_id properly
            const checkQuery = `
                SELECT customer_id, subscription_id, COALESCE(subscription_id, 0) as normalized_subscription_id
                FROM invoices
                WHERE period = ?
            `;
            const [existingInvoices] = await conn.query(checkQuery, [currentPeriod]);
            console.log(`Found ${existingInvoices.length} existing invoices for period ${currentPeriod}`);
            if (existingInvoices.length > 0) {
                console.log('Existing invoices:', existingInvoices.map((inv) => `customer_id: ${inv.customer_id}, subscription_id: ${inv.subscription_id}`));
            }
            // Create a map for exact match: customer_id + subscription_id (handling NULL as 0)
            const exactMatchSet = new Set();
            // Also track customers with invoices that have NULL/0 subscription_id (legacy invoices)
            const customersWithLegacyInvoices = new Set();
            for (const inv of existingInvoices) {
                const normalizedSubId = inv.normalized_subscription_id || 0;
                exactMatchSet.add(`${inv.customer_id}_${normalizedSubId}`);
                // Track if this is a legacy invoice (NULL or 0 subscription_id)
                if (!inv.subscription_id || inv.subscription_id === 0) {
                    customersWithLegacyInvoices.add(inv.customer_id);
                }
            }
            if (customersWithLegacyInvoices.size > 0) {
                console.log(`Found ${customersWithLegacyInvoices.size} customers with legacy invoices (NULL subscription_id):`, Array.from(customersWithLegacyInvoices));
            }
            let createdCount = 0;
            let skippedCount = 0;
            const errors = [];
            for (const subscription of subscriptions) {
                try {
                    // Check for exact match: customer_id + subscription_id
                    // Normalize subscription_id: if 0 or null, treat as 0
                    const normalizedSubId = (subscription.id && subscription.id > 0) ? subscription.id : 0;
                    const exactKey = `${subscription.customer_id}_${normalizedSubId}`;
                    // Check if invoice already exists for this period
                    // Priority: 1) Exact match (same customer + subscription), 2) Legacy invoice for same customer
                    const hasExactMatch = exactMatchSet.has(exactKey);
                    const hasLegacyInvoice = customersWithLegacyInvoices.has(subscription.customer_id);
                    if (hasExactMatch || hasLegacyInvoice) {
                        skippedCount++;
                        const subscriptionInfo = subscription.id && subscription.id > 0 ? `subscription_id: ${subscription.id}` : 'no subscription';
                        const reason = hasExactMatch
                            ? `exact match found (customer_id: ${subscription.customer_id}, subscription_id: ${subscription.id || 'NULL'})`
                            : `customer has legacy invoice with NULL/0 subscription_id for this period (customer_id: ${subscription.customer_id})`;
                        console.log(`⚠ Invoice already exists for customer ${subscription.customer_name} (${subscriptionInfo}) - ${reason}`);
                        continue;
                    }
                    const hasActiveSubscription = subscription.id && subscription.id > 0;
                    console.log(`✓ Processing customer ${subscription.customer_name} (customer_id: ${subscription.customer_id}${hasActiveSubscription ? `, subscription_id: ${subscription.id}` : ', no active subscription - using default price'})`);
                    // Calculate due date
                    const periodDate = new Date(currentPeriod + '-01');
                    const dueDate = new Date(periodDate);
                    dueDate.setDate(dueDate.getDate() + dueDateOffset);
                    const dueDateStr = dueDate.toISOString().slice(0, 10);
                    // Generate invoice number
                    const invoiceNumber = await this.generateInvoiceNumber(currentPeriod, conn);
                    // Determine price: use subscription price if available, otherwise use default
                    const defaultPrice = 100000; // Default price for customers without subscription
                    const subscriptionId = subscription.id && subscription.id > 0 ? subscription.id : null;
                    const price = parseFloat(subscription.price) || defaultPrice;
                    const packageName = subscription.package_name || 'Paket Internet Bulanan';
                    const subscriptionPrice = parseFloat(subscription.price) || 0;
                    // Only use subscription_id if it exists (not 0 or null)
                    const finalSubscriptionId = subscriptionId || null;
                    // Insert invoice
                    const invoiceInsertQuery = `
                        INSERT INTO invoices (
                            invoice_number, customer_id, subscription_id, period, due_date,
                            subtotal, discount_amount, total_amount, paid_amount, remaining_amount,
                            status, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 'sent', NOW(), NOW())
                    `;
                    const [invoiceResult] = await conn.execute(invoiceInsertQuery, [
                        invoiceNumber,
                        subscription.customer_id,
                        finalSubscriptionId,
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
                    const description = subscriptionPrice > 0
                        ? `Paket ${packageName} - ${currentPeriod}`
                        : `Paket Internet Bulanan - ${currentPeriod}`;
                    await conn.execute(itemInsertQuery, [
                        invoiceId,
                        description,
                        price,
                        price
                    ]);
                    createdCount++;
                    console.log(`✓ Invoice created for customer ${subscription.customer_name} (${invoiceNumber})`);
                }
                catch (itemError) {
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
                total_customers: subscriptions.length, // Alias for clarity in UI
                errors: errors.length > 0 ? errors : undefined
            });
        }
        catch (error) {
            await conn.rollback();
            console.error('Error generating bulk invoices:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal generate bulk invoice'
            });
        }
        finally {
            conn.release();
        }
    }
    /**
     * Update invoice status
     */
    async updateInvoiceStatus(req, res) {
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
            await pool_1.databasePool.query('UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
            res.json({
                success: true,
                message: 'Status invoice berhasil diperbarui'
            });
        }
        catch (error) {
            console.error('Error updating invoice status:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memperbarui status invoice'
            });
        }
    }
    /**
     * Send invoice detail via WhatsApp
     */
    async sendInvoiceWhatsApp(req, res) {
        try {
            const { id } = req.params;
            // Get invoice data
            const [rows] = await pool_1.databasePool.query(`
                SELECT i.*, 
                       c.name as customer_name, 
                       c.phone as customer_phone,
                       c.id as customer_id 
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `, [id]);
            if (rows.length === 0) {
                res.status(404).json({ success: false, message: 'Tagihan tidak ditemukan' });
                return;
            }
            const invoice = rows[0];
            if (!invoice.customer_phone) {
                res.status(400).json({ success: false, message: 'Customer tidak memiliki nomor telepon' });
                return;
            }
            // Construct message
            const message = `Halo ${invoice.customer_name},\n\n` +
                `Berikut adalah detail tagihan internet Anda:\n` +
                `Nomor Tagihan: *${invoice.invoice_number}*\n` +
                `Periode: ${invoice.period}\n` +
                `Total: *Rp ${parseInt(invoice.total_amount).toLocaleString('id-ID')}*\n` +
                `Status: ${invoice.status.toUpperCase()}\n` +
                `Jatuh Tempo: ${new Date(invoice.due_date).toLocaleDateString('id-ID')}\n\n` +
                `Silakan melakukan pembayaran sebelum jatuh tempo. Terima kasih.`;
            // Import dynamically to avoid circular dependency issues if any
            const { WhatsAppService } = await Promise.resolve().then(() => __importStar(require('../../services/whatsapp/WhatsAppService')));
            const result = await WhatsAppService.sendMessage(invoice.customer_phone, message, { customerId: invoice.customer_id });
            if (result.success) {
                // Optional: Update invoice status if it was draft
                if (invoice.status === 'draft') {
                    await pool_1.databasePool.query('UPDATE invoices SET status = "sent" WHERE id = ?', [id]);
                }
                res.json({ success: true, message: 'Pesan WhatsApp berhasil dikirim' });
            }
            else {
                res.status(500).json({ success: false, message: 'Gagal mengirim WhatsApp: ' + result.error });
            }
        }
        catch (error) {
            console.error('Error sending WhatsApp invoice:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * Delete invoice
     */
    async deleteInvoice(req, res) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.beginTransaction();
            const { id } = req.params;
            // Delete associated payments
            await conn.execute('DELETE FROM payments WHERE invoice_id = ?', [id]);
            // Delete associated discounts
            await conn.execute('DELETE FROM discounts WHERE invoice_id = ?', [id]);
            // Delete associated debt tracking
            await conn.execute('DELETE FROM debt_tracking WHERE invoice_id = ?', [id]);
            // Delete invoice items
            await conn.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
            // Delete invoice
            await conn.execute('DELETE FROM invoices WHERE id = ?', [id]);
            await conn.commit();
            res.json({
                success: true,
                message: 'Invoice berhasil dihapus'
            });
        }
        catch (error) {
            await conn.rollback();
            console.error('Error deleting invoice:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menghapus invoice'
            });
        }
        finally {
            conn.release();
        }
    }
    /**
     * Generate unique invoice number
     */
    async generateInvoiceNumber(period, conn) {
        const connection = conn || pool_1.databasePool;
        // Format: INV/YYYY/MM/XXXX
        const [year, month] = period.split('-');
        // Get last invoice number for this period
        const [result] = await connection.query(`
            SELECT invoice_number 
            FROM invoices 
            WHERE period = ? 
            ORDER BY invoice_number DESC 
            LIMIT 1
        `, [period]);
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
exports.InvoiceController = InvoiceController;
//# sourceMappingURL=invoiceController.js.map