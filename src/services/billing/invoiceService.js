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
exports.InvoiceService = void 0;
const pool_1 = require("../../db/pool");
class InvoiceService {
    /**
     * Generate nomor invoice unik
     */
    static async generateInvoiceNumber(period) {
        const year = period.split('-')[0];
        const month = period.split('-')[1];
        const query = `
            SELECT COUNT(*) as count 
            FROM invoices 
            WHERE invoice_number LIKE ?
        `;
        const pattern = `INV/${year}/${month}/%`;
        const [result] = await pool_1.databasePool.query(query, [pattern]);
        const count = parseInt(result[0].count) + 1;
        return `INV/${year}/${month}/${count.toString().padStart(4, '0')}`;
    }
    /**
     * Buat invoice baru
     */
    static async createInvoice(invoiceData, items) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            await connection.beginTransaction();
            // Generate nomor invoice
            const invoiceNumber = await this.generateInvoiceNumber(invoiceData.period);
            // Insert invoice
            const invoiceQuery = `
                INSERT INTO invoices (
                    invoice_number, customer_id, subscription_id, period, 
                    due_date, subtotal, discount_amount, ppn_rate, ppn_amount, device_fee, total_amount, 
                    paid_amount, remaining_amount, status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const paidAmount = invoiceData.paid_amount || 0;
            const remainingAmount = Math.max(0, invoiceData.total_amount - paidAmount);
            const status = invoiceData.status || (remainingAmount <= 0 ? 'paid' : 'sent');
            const [invoiceResult] = await connection.execute(invoiceQuery, [
                invoiceNumber,
                invoiceData.customer_id,
                invoiceData.subscription_id || null,
                invoiceData.period,
                invoiceData.due_date || new Date().toISOString().split('T')[0],
                invoiceData.subtotal || 0,
                invoiceData.discount_amount || 0,
                invoiceData.ppn_rate || 0,
                invoiceData.ppn_amount || 0,
                invoiceData.device_fee || 0,
                invoiceData.total_amount || 0,
                paidAmount,
                remainingAmount,
                status,
                invoiceData.notes || null
            ]);
            const invoiceId = invoiceResult.insertId;
            // Insert invoice items using batch insert for better performance
            if (items.length > 0) {
                const itemQuery = `
                    INSERT INTO invoice_items (
                        invoice_id, description, quantity, unit_price, total_price
                    ) VALUES ?
                `;
                const itemValues = items.map(item => [
                    invoiceId,
                    item.description,
                    item.quantity || 1,
                    item.unit_price,
                    item.total_price
                ]);
                await connection.query(itemQuery, [itemValues]);
            }
            await connection.commit();
            // Send notification if invoice status is 'sent'
            if (invoiceData.status === 'sent' || invoiceData.status === undefined) {
                try {
                    const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../../services/notification/UnifiedNotificationService')));
                    await UnifiedNotificationService.notifyInvoiceCreated(invoiceId);
                }
                catch (notifError) {
                    console.error('Error sending invoice created notification:', notifError);
                    // Don't throw - notification failure shouldn't break invoice creation
                }
            }
            return invoiceId;
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Handle partial payment dengan debt tracking
     */
    static async handlePartialPayment(invoiceId, paymentAmount, paymentMethod, notes) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            await connection.beginTransaction();
            // Get invoice details
            const [invoiceRows] = await connection.execute('SELECT total_amount, customer_id, period FROM invoices WHERE id = ?', [invoiceId]);
            if (!Array.isArray(invoiceRows) || invoiceRows.length === 0) {
                throw new Error('Invoice not found');
            }
            const invoice = invoiceRows[0];
            const totalAmount = parseFloat(invoice.total_amount);
            const customerId = invoice.customer_id;
            const period = invoice.period;
            // Get current paid amount
            const [paymentRows] = await connection.execute('SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = ?', [invoiceId]);
            const currentPaid = parseFloat(paymentRows[0].total_paid);
            const newPaidAmount = currentPaid + paymentAmount;
            const remainingAmount = totalAmount - newPaidAmount;
            // Record payment
            await connection.execute('INSERT INTO payments (invoice_id, payment_method, amount, notes, created_at) VALUES (?, ?, ?, ?, NOW())', [invoiceId, paymentMethod, paymentAmount, notes || 'Partial payment']);
            // Update invoice status
            let newStatus = 'draft';
            if (newPaidAmount >= totalAmount) {
                newStatus = 'paid';
            }
            else if (newPaidAmount > 0) {
                newStatus = 'partial';
            }
            await connection.execute('UPDATE invoices SET paid_amount = ?, remaining_amount = ?, status = ?, last_payment_date = NOW(), updated_at = NOW() WHERE id = ?', [newPaidAmount, remainingAmount, newStatus, invoiceId]);
            // Create debt tracking if there's remaining amount
            if (remainingAmount > 0) {
                await connection.execute('INSERT INTO debt_tracking (customer_id, invoice_id, debt_amount, debt_reason, status) VALUES (?, ?, ?, ?, "active")', [customerId, invoiceId, remainingAmount, `Partial payment - remaining balance for period ${period}`, 'active']);
                // Create carry over for next period
                const nextPeriod = this.getNextPeriod(period);
                await connection.execute('INSERT INTO carry_over_invoices (customer_id, carry_over_amount, target_period, status) VALUES (?, ?, ?, "pending")', [customerId, remainingAmount, nextPeriod]);
            }
            await connection.commit();
            return {
                success: true,
                message: `Payment recorded successfully. ${remainingAmount > 0 ? `Remaining amount: Rp ${remainingAmount.toLocaleString('id-ID')}` : 'Invoice fully paid!'}`,
                remainingAmount: remainingAmount > 0 ? remainingAmount : 0
            };
        }
        catch (error) {
            await connection.rollback();
            console.error('Error handling partial payment:', error);
            return {
                success: false,
                message: `Error processing payment: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
        finally {
            connection.release();
        }
    }
    /**
     * Get next period for carry over
     */
    static getNextPeriod(currentPeriod) {
        const [year, month] = currentPeriod.split('-');
        if (!year || !month) {
            throw new Error('Invalid period format');
        }
        const currentDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        return `${nextDate.getFullYear()}-${(nextDate.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    /**
     * Generate invoice otomatis untuk semua subscription aktif dengan carry over
     */
    static async generateMonthlyInvoices(period, customerId, forceAll = false) {
        const periodDate = new Date(period + '-01');
        const invoiceIds = [];
        console.log(`[InvoiceService] Starting generateMonthlyInvoices for period: ${period}`);
        if (customerId)
            console.log(`[InvoiceService] Filtering for customer ID: ${customerId}`);
        if (forceAll)
            console.log(`[InvoiceService] Force all mode enabled`);
        try {
            // Cek apakah periode valid
            if (isNaN(periodDate.getTime())) {
                throw new Error(`Periode tidak valid: ${period}`);
            }
            // Get System Settings
            const { SettingsService } = await Promise.resolve().then(() => __importStar(require('../../services/SettingsService')));
            const ppnEnabled = await SettingsService.getBoolean('ppn_enabled');
            const ppnRate = ppnEnabled ? await SettingsService.getNumber('ppn_rate') : 0;
            const deviceRentalEnabled = await SettingsService.getBoolean('device_rental_enabled');
            const deviceRentalFee = await SettingsService.getNumber('device_rental_fee');
            // Get Scheduler Settings for Due Date
            let fixedDay = 28;
            let dayOffset = 7;
            let useFixedDay = true;
            try {
                const [schedRows] = await pool_1.databasePool.query(`
                    SELECT config FROM scheduler_settings WHERE task_name = 'invoice_generation' LIMIT 1
                `);
                if (schedRows.length > 0 && schedRows[0].config) {
                    const config = typeof schedRows[0].config === 'string'
                        ? JSON.parse(schedRows[0].config)
                        : schedRows[0].config;
                    if (config.due_date_fixed_day)
                        fixedDay = parseInt(config.due_date_fixed_day);
                    if (config.due_date_offset)
                        dayOffset = parseInt(config.due_date_offset);
                    // Logic: If fixed day is defined and > 0, use it. Otherwise use offset.
                    // Default config usually has both, so we prioritize fixed day for monthly invoices.
                    useFixedDay = fixedDay > 0;
                }
            }
            catch (err) {
                console.warn('[InvoiceService] Failed to load scheduler settings, using defaults:', err);
            }
            // Coba dengan tabel subscriptions terlebih dahulu
            // Generate invoice berdasarkan DAY(start_date) untuk billing mengikuti tanggal daftar
            let subscriptionQuery = `
                SELECT s.id as subscription_id, s.customer_id, s.package_name, s.price,
                       c.name as customer_name, c.email, c.phone, s.start_date,
                       DAY(s.start_date) as billing_day, c.account_balance, c.use_device_rental, c.is_taxable,
                       c.customer_code, c.rental_mode, c.rental_cost
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                WHERE s.status = 'active' 
                AND (s.end_date IS NULL OR s.end_date >= CURDATE())
            `;
            const queryParams = [];
            // Jika tidak dipaksa dan tidak ada customerId spesifik, cek tanggal billing
            if (!forceAll && !customerId) {
                subscriptionQuery += ` AND DAY(s.start_date) = DAY(CURDATE()) `;
            }
            // Filter customerId jika ada
            if (customerId) {
                subscriptionQuery += ` AND s.customer_id = ? `;
                queryParams.push(customerId);
            }
            subscriptionQuery += `
                AND s.id NOT IN (
                    SELECT DISTINCT subscription_id 
                    FROM invoices 
                    WHERE period = ? AND subscription_id IS NOT NULL
                )
            `;
            queryParams.push(period);
            console.log(`[InvoiceService] Executing subscription query for period: ${period}`);
            const [subscriptionResult] = await pool_1.databasePool.query(subscriptionQuery, queryParams);
            const subscriptions = subscriptionResult;
            console.log(`[InvoiceService] Found ${subscriptions.length} pending subscriptions untuk diproses`);
            if (subscriptions.length > 0) {
                for (const subscription of subscriptions) {
                    try {
                        console.log(`[InvoiceService] Processing subscription: ${subscription.subscription_id} for customer: ${subscription.customer_name}`);
                        // Jatuh tempo: Dynamic based on scheduler settings
                        const periodYear = parseInt(period.split('-')[0] || new Date().getFullYear().toString());
                        const periodMonth = parseInt(period.split('-')[1] || (new Date().getMonth() + 1).toString());
                        let dueDate;
                        if (useFixedDay) {
                            // Use fixed day (e.g. 28)
                            const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
                            const targetDay = Math.min(fixedDay, daysInMonth);
                            dueDate = new Date(periodYear, periodMonth - 1, targetDay);
                        }
                        else {
                            // Use offset (e.g. 1st + 7 days)
                            dueDate = new Date(periodYear, periodMonth - 1, 1);
                            dueDate.setDate(dueDate.getDate() + dayOffset);
                        }
                        // Check for carry over amount
                        let carryOverAmount = 0;
                        try {
                            const [carryOverResult] = await pool_1.databasePool.query(`
                                SELECT COALESCE(SUM(carry_over_amount), 0) as carry_over_amount
                                FROM carry_over_invoices 
                                WHERE customer_id = ? AND target_period = ? AND status = 'pending'
                            `, [subscription.customer_id, period]);
                            carryOverAmount = parseFloat(carryOverResult[0].carry_over_amount || 0);
                        }
                        catch (e) { }
                        const subtotal = subscription.price || 0;
                        let deviceFee = 0;
                        if (deviceRentalEnabled && subscription.use_device_rental) {
                            const rentalCost = subscription.rental_cost !== null && subscription.rental_cost !== undefined
                                ? Number(subscription.rental_cost)
                                : Number(deviceRentalFee);
                            const rentalMode = subscription.rental_mode || 'flat';
                            if (rentalMode === 'daily') {
                                const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
                                deviceFee = rentalCost * daysInMonth;
                            }
                            else {
                                deviceFee = rentalCost;
                            }
                        }
                        let ppnAmount = 0;
                        if (ppnEnabled && ppnRate > 0 && subscription.is_taxable) {
                            const taxBase = subtotal + deviceFee;
                            ppnAmount = Math.round(taxBase * (ppnRate / 100));
                        }
                        const totalAmount = subtotal + deviceFee + ppnAmount + carryOverAmount;
                        // Apply balance deduction
                        let accountBalance = parseFloat(subscription.account_balance || 0);
                        let amountFromBalance = 0;
                        if (accountBalance > 0) {
                            amountFromBalance = Math.min(accountBalance, totalAmount);
                        }
                        const invoiceData = {
                            customer_id: subscription.customer_id,
                            subscription_id: subscription.subscription_id,
                            period: period,
                            due_date: dueDate.toISOString().split('T')[0],
                            subtotal: subtotal,
                            ppn_rate: ppnEnabled ? ppnRate : 0,
                            ppn_amount: ppnAmount,
                            device_fee: deviceFee,
                            total_amount: totalAmount,
                            paid_amount: amountFromBalance,
                            discount_amount: 0,
                            notes: carryOverAmount > 0 ? `Include carry over: Rp ${carryOverAmount.toLocaleString('id-ID')}` : undefined
                        };
                        const items = [{
                                description: `Paket ${subscription.package_name || 'Internet'} - ${period}`,
                                quantity: 1,
                                unit_price: subtotal,
                                total_price: subtotal
                            }];
                        if (deviceFee > 0) {
                            items.push({ description: `Sewa Perangkat - ${period}`, quantity: 1, unit_price: deviceFee, total_price: deviceFee });
                        }
                        if (carryOverAmount > 0) {
                            items.push({ description: `Sisa Hutang Bulan Sebelumnya - ${period}`, quantity: 1, unit_price: carryOverAmount, total_price: carryOverAmount });
                        }
                        const invoiceId = await this.createInvoice(invoiceData, items);
                        invoiceIds.push(invoiceId);
                        // Finalize balance and carry over
                        if (amountFromBalance > 0) {
                            await pool_1.databasePool.execute('UPDATE customers SET account_balance = account_balance - ? WHERE id = ?', [amountFromBalance, subscription.customer_id]);
                            await pool_1.databasePool.execute('INSERT INTO payments (invoice_id, payment_method, amount, payment_date, gateway_status, notes, created_by, created_at) VALUES (?, "balance", ?, NOW(), "COMPLETED", "Otomatis potong saldo", 0, NOW())', [invoiceId, amountFromBalance]);
                        }
                        if (carryOverAmount > 0) {
                            await pool_1.databasePool.execute('UPDATE carry_over_invoices SET status = "applied", applied_at = NOW() WHERE customer_id = ? AND target_period = ? AND status = "pending"', [subscription.customer_id, period]);
                        }
                    }
                    catch (err) {
                        console.error(`[InvoiceService] Error subscription ${subscription.subscription_id}:`, err);
                    }
                }
            }
            // 2. Fallback: Customers WITHOUT active subscriptions processed in group 1
            console.log(`[InvoiceService] Checking for customers without active subscriptions for period: ${period}`);
            let customerQuery = `
                SELECT c.id as customer_id, c.name as customer_name, c.email, c.phone, c.account_balance, 
                       c.use_device_rental, c.is_taxable, c.rental_mode, c.rental_cost, c.created_at
                FROM customers c
                WHERE c.status = 'active'
                AND c.id NOT IN (SELECT customer_id FROM invoices WHERE period = ?)
                AND c.id NOT IN (SELECT customer_id FROM subscriptions WHERE status = 'active')
            `;
            const customerParams = [period];
            if (!forceAll && !customerId) {
                customerQuery += ` AND DAY(c.created_at) = DAY(CURDATE()) `;
            }
            if (customerId) {
                customerQuery += ` AND c.id = ? `;
                customerParams.push(customerId);
            }
            const [customerResult] = await pool_1.databasePool.query(customerQuery, customerParams);
            const customers = customerResult;
            console.log(`[InvoiceService] Found ${customers.length} eligible customers without active subscriptions`);
            if (customers.length === 0 && customerId) {
                console.log(`[InvoiceService] ⚠️ Manual check: Customer ${customerId} was NOT found in fallback group. Checking why...`);
                const [check] = await pool_1.databasePool.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM invoices WHERE customer_id = ? AND period = ?) as existing_invoices,
                        (SELECT COUNT(*) FROM subscriptions WHERE customer_id = ? AND status = 'active') as active_subs,
                        status
                    FROM customers WHERE id = ?
                `, [customerId, period, customerId, customerId]);
                console.log(`[InvoiceService] Reasons for skip:`, check);
            }
            for (const customer of customers) {
                try {
                    const periodYear = parseInt(period.split('-')[0] || new Date().getFullYear().toString());
                    const periodMonth = parseInt(period.split('-')[1] || (new Date().getMonth() + 1).toString());
                    let dueDate;
                    if (useFixedDay) {
                        const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
                        const targetDay = Math.min(fixedDay, daysInMonth);
                        dueDate = new Date(periodYear, periodMonth - 1, targetDay);
                    }
                    else {
                        dueDate = new Date(periodYear, periodMonth - 1, 1);
                        dueDate.setDate(dueDate.getDate() + dayOffset);
                    }
                    // Fallback price logic: package info is missing in fallback, using default or zero
                    let subtotal = 0;
                    let packageName = 'Internet Service (Fallback)';
                    let deviceFee = 0;
                    if (deviceRentalEnabled && customer.use_device_rental) {
                        const rentalCost = customer.rental_cost !== null && customer.rental_cost !== undefined ? Number(customer.rental_cost) : Number(deviceRentalFee);
                        const rentalMode = customer.rental_mode || 'flat';
                        if (rentalMode === 'daily') {
                            const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
                            deviceFee = rentalCost * daysInMonth;
                        }
                        else {
                            deviceFee = rentalCost;
                        }
                    }
                    let ppnAmount = 0;
                    if (ppnEnabled && ppnRate > 0 && customer.is_taxable) {
                        ppnAmount = Math.round((subtotal + deviceFee) * (ppnRate / 100));
                    }
                    const totalAmount = subtotal + deviceFee + ppnAmount;
                    const customerBalance = parseFloat(customer.account_balance || 0);
                    const amountFromBalance = Math.min(customerBalance, totalAmount);
                    const invoiceId = await this.createInvoice({
                        customer_id: customer.customer_id,
                        subscription_id: null,
                        period: period,
                        due_date: dueDate.toISOString().split('T')[0],
                        subtotal: subtotal,
                        ppn_rate: ppnEnabled ? ppnRate : 0,
                        ppn_amount: ppnAmount,
                        device_fee: deviceFee,
                        total_amount: totalAmount,
                        paid_amount: amountFromBalance,
                        notes: 'Tagihan bulanan (Customer Fallback)'
                    }, [{
                            description: `Layanan ${packageName} - ${period}`,
                            quantity: 1,
                            unit_price: subtotal,
                            total_price: subtotal
                        }]);
                    console.log(`[InvoiceService] ✅ Created fallback invoice for ${customer.customer_name} ID: ${invoiceId} Amount: ${totalAmount}`);
                    invoiceIds.push(invoiceId);
                    if (amountFromBalance > 0) {
                        await pool_1.databasePool.execute('UPDATE customers SET account_balance = account_balance - ? WHERE id = ?', [amountFromBalance, customer.customer_id]);
                        await pool_1.databasePool.execute('INSERT INTO payments (invoice_id, payment_method, amount, payment_date, notes) VALUES (?, "balance", ?, NOW(), "Otomatis potong saldo")', [invoiceId, amountFromBalance]);
                    }
                }
                catch (err) {
                    console.error(`[InvoiceService] Error fallback customer ${customer.customer_id}:`, err);
                }
            }
        }
        catch (error) {
            console.error('[InvoiceService] Error in generateMonthlyInvoices:', error);
            console.error('[InvoiceService] Error stack:', error.stack);
            throw error;
        }
        console.log(`[InvoiceService] Completed generateMonthlyInvoices for period ${period}. Created ${invoiceIds.length} invoices.`);
        return invoiceIds;
    }
    /**
     * Update status invoice
     */
    static async updateInvoiceStatus(invoiceId, status) {
        const query = `
            UPDATE invoices 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        await pool_1.databasePool.query(query, [status, invoiceId]);
    }
    /**
     * Get invoice by ID
     */
    static async getInvoiceById(invoiceId) {
        const query = `
            SELECT i.*, c.name as customer_name, c.email, c.phone, c.address,
                   c.odc_id, odc.name as odc_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
            WHERE i.id = ?
        `;
        const [result] = await pool_1.databasePool.query(query, [invoiceId]);
        return result[0];
    }
    /**
     * Get invoice items
     */
    static async getInvoiceItems(invoiceId) {
        const query = `
            SELECT * FROM invoice_items 
            WHERE invoice_id = ? 
            ORDER BY id
        `;
        const [result] = await pool_1.databasePool.query(query, [invoiceId]);
        return result;
    }
    /**
     * Get invoices dengan filter
     */
    static async getInvoices(filters = {}) {
        let query = `
            SELECT i.*, c.name as customer_name, c.phone, c.email,
                   odc.name as odc_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
            WHERE 1=1
        `;
        const params = [];
        if (filters.status) {
            query += ` AND i.status = ?`;
            params.push(filters.status);
        }
        if (filters.period) {
            query += ` AND i.period = ?`;
            params.push(filters.period);
        }
        if (filters.odc_id) {
            query += ` AND c.odc_id = ?`;
            params.push(filters.odc_id);
        }
        if (filters.customer_id) {
            query += ` AND i.customer_id = ?`;
            params.push(filters.customer_id);
        }
        query += ` ORDER BY i.created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT ?`;
            params.push(filters.limit);
        }
        if (filters.offset) {
            query += ` OFFSET ?`;
            params.push(filters.offset);
        }
        const [result] = await pool_1.databasePool.query(query, params);
        return result;
    }
    /**
     * Mark invoice as sent
     */
    static async markAsSent(invoiceId) {
        await this.updateInvoiceStatus(invoiceId, 'sent');
    }
    /**
     * Get overdue invoices
     */
    static async getOverdueInvoices() {
        const query = `
            SELECT i.*, c.name as customer_name, c.phone, c.email,
                   odc.name as odc_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
            WHERE i.status IN ('sent', 'partial') 
            AND i.due_date < CURRENT_DATE
            ORDER BY i.due_date ASC
        `;
        const [result] = await pool_1.databasePool.query(query);
        return result;
    }
    /**
     * Bulk delete invoices
     */
    static async bulkDeleteInvoices(invoiceIds) {
        const connection = await pool_1.databasePool.getConnection();
        const result = {
            deleted: 0,
            failed: 0,
            errors: []
        };
        try {
            await connection.beginTransaction();
            for (const invoiceId of invoiceIds) {
                try {
                    // Check if invoice exists
                    const checkQuery = `
                        SELECT i.id, i.status, c.name as customer_name
                        FROM invoices i
                        JOIN customers c ON i.customer_id = c.id
                        WHERE i.id = ?
                    `;
                    const [checkResult] = await connection.query(checkQuery, [invoiceId]);
                    const invoice = checkResult[0];
                    if (!invoice) {
                        result.failed++;
                        result.errors.push(`Invoice ID ${invoiceId} tidak ditemukan`);
                        continue;
                    }
                    // Check if invoice has payments - but allow deletion with warning
                    const paymentQuery = `
                        SELECT COUNT(*) as payment_count, SUM(amount) as total_paid
                        FROM payments 
                        WHERE invoice_id = ?
                    `;
                    const [paymentResult] = await connection.query(paymentQuery, [invoiceId]);
                    const paymentCount = parseInt(paymentResult[0].payment_count);
                    const totalPaid = parseFloat(paymentResult[0].total_paid) || 0;
                    // Allow deletion even if there are payments, but log warning
                    if (paymentCount > 0) {
                        console.warn(`Warning: Deleting invoice ${invoice.customer_name} (${invoiceId}) that has ${paymentCount} payments totaling ${totalPaid}`);
                    }
                    // Delete related records first
                    await connection.query(`DELETE FROM payments WHERE invoice_id = ?`, [invoiceId]);
                    await connection.query(`DELETE FROM invoice_items WHERE invoice_id = ?`, [invoiceId]);
                    // Delete invoice
                    await connection.query(`DELETE FROM invoices WHERE id = ?`, [invoiceId]);
                    result.deleted++;
                }
                catch (error) {
                    console.error(`Error deleting invoice ${invoiceId}:`, error);
                    result.failed++;
                    result.errors.push(`Error menghapus invoice ${invoiceId}: ${error.message}`);
                }
            }
            await connection.commit();
            return result;
        }
        catch (error) {
            console.error('Error in bulk delete transaction:', error);
            await connection.rollback();
            throw new Error(`Bulk delete failed: ${error.message}`);
        }
        finally {
            connection.release();
        }
    }
    /**
     * Delete single invoice
     */
    static async deleteInvoice(invoiceId) {
        try {
            // Check if invoice exists
            const checkQuery = `
                SELECT i.id, i.status, c.name as customer_name
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `;
            const [checkResult] = await pool_1.databasePool.query(checkQuery, [invoiceId]);
            const invoice = checkResult[0];
            if (!invoice) {
                return { success: false, message: 'Invoice tidak ditemukan' };
            }
            // Check if invoice has payments - but allow deletion with warning
            const paymentQuery = `
                SELECT COUNT(*) as payment_count, SUM(amount) as total_paid
                FROM payments 
                WHERE invoice_id = ?
            `;
            const [paymentResult] = await pool_1.databasePool.query(paymentQuery, [invoiceId]);
            const paymentCount = parseInt(paymentResult[0].payment_count);
            const totalPaid = parseFloat(paymentResult[0].total_paid) || 0;
            const connection = await pool_1.databasePool.getConnection();
            try {
                await connection.beginTransaction();
                // Delete related records first
                await connection.query(`DELETE FROM payments WHERE invoice_id = ?`, [invoiceId]);
                await connection.query(`DELETE FROM invoice_items WHERE invoice_id = ?`, [invoiceId]);
                // Delete invoice
                await connection.query(`DELETE FROM invoices WHERE id = ?`, [invoiceId]);
                await connection.commit();
                let message = `Invoice ${invoice.customer_name} berhasil dihapus`;
                if (paymentCount > 0) {
                    message += ` (Warning: ${paymentCount} pembayaran sebesar Rp ${totalPaid.toLocaleString('id-ID')} juga dihapus)`;
                }
                return {
                    success: true,
                    message: message
                };
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Error menghapus invoice: ${error.message}`
            };
        }
    }
}
exports.InvoiceService = InvoiceService;
