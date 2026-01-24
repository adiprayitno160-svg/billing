import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export interface InvoiceData {
    customer_id: number;
    subscription_id?: number;
    period: string;
    due_date: string;
    subtotal: number;
    discount_amount?: number;
    ppn_rate?: number;
    ppn_amount?: number;
    device_fee?: number;
    total_amount: number;
    paid_amount?: number;
    notes?: string;
    status?: string;
}

export interface InvoiceItem {
    description: string;
    quantity?: number;
    unit_price: number;
    total_price: number;
}

export class InvoiceService {
    /**
     * Generate nomor invoice unik
     */
    static async generateInvoiceNumber(period: string): Promise<string> {
        const year = period.split('-')[0];
        const month = period.split('-')[1];

        const query = `
            SELECT COUNT(*) as count 
            FROM invoices 
            WHERE invoice_number LIKE ?
        `;

        const pattern = `INV/${year}/${month}/%`;
        const [result] = await databasePool.query(query, [pattern]);
        const count = parseInt((result as any)[0].count) + 1;

        return `INV/${year}/${month}/${count.toString().padStart(4, '0')}`;
    }

    /**
     * Buat invoice baru
     */
    static async createInvoice(invoiceData: InvoiceData, items: InvoiceItem[]): Promise<number> {
        const connection = await databasePool.getConnection();

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
                invoiceData.customer_id || 0,
                invoiceData.subscription_id || 0,
                invoiceData.period || '2025-01',
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

            const invoiceId = (invoiceResult as any).insertId;

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
                    const { UnifiedNotificationService } = await import('../../services/notification/UnifiedNotificationService');
                    await UnifiedNotificationService.notifyInvoiceCreated(invoiceId);
                } catch (notifError) {
                    console.error('Error sending invoice created notification:', notifError);
                    // Don't throw - notification failure shouldn't break invoice creation
                }
            }

            return invoiceId;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Handle partial payment dengan debt tracking
     */
    static async handlePartialPayment(invoiceId: number, paymentAmount: number, paymentMethod: string, notes?: string): Promise<{ success: boolean, message: string, remainingAmount?: number }> {
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            // Get invoice details
            const [invoiceRows] = await connection.execute(
                'SELECT total_amount, customer_id, period FROM invoices WHERE id = ?',
                [invoiceId]
            );

            if (!Array.isArray(invoiceRows) || invoiceRows.length === 0) {
                throw new Error('Invoice not found');
            }

            const invoice = (invoiceRows as any[])[0];
            const totalAmount = parseFloat(invoice.total_amount);
            const customerId = invoice.customer_id;
            const period = invoice.period;

            // Get current paid amount
            const [paymentRows] = await connection.execute(
                'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = ?',
                [invoiceId]
            );

            const currentPaid = parseFloat(((paymentRows as any[])[0] as any).total_paid);
            const newPaidAmount = currentPaid + paymentAmount;
            const remainingAmount = totalAmount - newPaidAmount;

            // Record payment
            await connection.execute(
                'INSERT INTO payments (invoice_id, payment_method, amount, notes, created_at) VALUES (?, ?, ?, ?, NOW())',
                [invoiceId, paymentMethod, paymentAmount, notes || 'Partial payment']
            );

            // Update invoice status
            let newStatus = 'draft';
            if (newPaidAmount >= totalAmount) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partial';
            }

            await connection.execute(
                'UPDATE invoices SET paid_amount = ?, remaining_amount = ?, status = ?, last_payment_date = NOW(), updated_at = NOW() WHERE id = ?',
                [newPaidAmount, remainingAmount, newStatus, invoiceId]
            );

            // Create debt tracking if there's remaining amount
            if (remainingAmount > 0) {
                await connection.execute(
                    'INSERT INTO debt_tracking (customer_id, invoice_id, debt_amount, debt_reason, status) VALUES (?, ?, ?, ?, "active")',
                    [customerId, invoiceId, remainingAmount, `Partial payment - remaining balance for period ${period}`, 'active']
                );

                // Create carry over for next period
                const nextPeriod = this.getNextPeriod(period);
                await connection.execute(
                    'INSERT INTO carry_over_invoices (customer_id, carry_over_amount, target_period, status) VALUES (?, ?, ?, "pending")',
                    [customerId, remainingAmount, nextPeriod]
                );
            }

            await connection.commit();

            return {
                success: true,
                message: `Payment recorded successfully. ${remainingAmount > 0 ? `Remaining amount: Rp ${remainingAmount.toLocaleString('id-ID')}` : 'Invoice fully paid!'}`,
                remainingAmount: remainingAmount > 0 ? remainingAmount : 0
            };

        } catch (error) {
            await connection.rollback();
            console.error('Error handling partial payment:', error);
            return {
                success: false,
                message: `Error processing payment: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        } finally {
            connection.release();
        }
    }

    /**
     * Get next period for carry over
     */
    private static getNextPeriod(currentPeriod: string): string {
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
    static async generateMonthlyInvoices(period: string, customerId?: number, forceAll: boolean = false): Promise<number[]> {
        const periodDate = new Date(period + '-01');
        const invoiceIds: number[] = [];

        console.log(`[InvoiceService] Starting generateMonthlyInvoices for period: ${period}`);
        if (customerId) console.log(`[InvoiceService] Filtering for customer ID: ${customerId}`);
        if (forceAll) console.log(`[InvoiceService] Force all mode enabled`);

        try {
            // Cek apakah periode valid
            if (isNaN(periodDate.getTime())) {
                throw new Error(`Periode tidak valid: ${period}`);
            }

            // Get System Settings
            const { SettingsService } = await import('../../services/SettingsService');
            const ppnEnabled = await SettingsService.getBoolean('ppn_enabled');
            const ppnRate = ppnEnabled ? await SettingsService.getNumber('ppn_rate') : 0;
            const deviceRentalEnabled = await SettingsService.getBoolean('device_rental_enabled');
            const deviceRentalFee = await SettingsService.getNumber('device_rental_fee');

            // Get Scheduler Settings for Due Date
            let fixedDay = 28;
            let dayOffset = 7;
            let useFixedDay = true;

            try {
                const [schedRows] = await databasePool.query<RowDataPacket[]>(`
                    SELECT config FROM scheduler_settings WHERE task_name = 'invoice_generation' LIMIT 1
                `);

                if (schedRows.length > 0 && schedRows[0].config) {
                    const config = typeof schedRows[0].config === 'string'
                        ? JSON.parse(schedRows[0].config)
                        : schedRows[0].config;

                    if (config.due_date_fixed_day) fixedDay = parseInt(config.due_date_fixed_day);
                    if (config.due_date_offset) dayOffset = parseInt(config.due_date_offset);

                    // Logic: If fixed day is defined and > 0, use it. Otherwise use offset.
                    // Default config usually has both, so we prioritize fixed day for monthly invoices.
                    useFixedDay = fixedDay > 0;
                }
            } catch (err) {
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

            const queryParams: any[] = [];

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
            const [subscriptionResult] = await databasePool.query(subscriptionQuery, queryParams);
            console.log(`[InvoiceService] Found ${(subscriptionResult as any[]).length} subscriptions`);

            // 1. Generate from subscriptions
            console.log(`[InvoiceService] Executing subscription query for period: ${period}`);
            const [rows] = await databasePool.query(subscriptionQuery, queryParams);
            const subscriptions = rows as any[];
            console.log(`[InvoiceService] Found ${subscriptions.length} pending subscriptions`);

            if (subscriptions.length > 0) {
                for (const subscription of subscriptions) {
                    try {
                        console.log(`[InvoiceService] Processing subscription: ${subscription.subscription_id} for customer: ${subscription.customer_name}`);

                        // Jatuh tempo: Dynamic based on scheduler settings
                        const periodYear = parseInt(period.split('-')[0] || new Date().getFullYear().toString());
                        const periodMonth = parseInt(period.split('-')[1] || (new Date().getMonth() + 1).toString());
                        let dueDate: Date;

                        if (useFixedDay) {
                            // Use fixed day (e.g. 28)
                            const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
                            const targetDay = Math.min(fixedDay, daysInMonth);
                            dueDate = new Date(periodYear, periodMonth - 1, targetDay);
                        } else {
                            // Use offset (e.g. 1st + 7 days)
                            dueDate = new Date(periodYear, periodMonth - 1, 1);
                            dueDate.setDate(dueDate.getDate() + dayOffset);
                        }

                        // Check for carry over amount
                        let carryOverAmount = 0;
                        try {
                            const [carryOverResult] = await databasePool.query(`
                                SELECT COALESCE(SUM(carry_over_amount), 0) as carry_over_amount
                                FROM carry_over_invoices 
                                WHERE customer_id = ? AND target_period = ? AND status = 'pending'
                            `, [subscription.customer_id, period]);
                            carryOverAmount = parseFloat(((carryOverResult as any[])[0] as any).carry_over_amount || 0);
                        } catch (e) { }

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
                            } else {
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

                        const invoiceData: InvoiceData = {
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

                        const items: InvoiceItem[] = [{
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
                            await databasePool.execute('UPDATE customers SET account_balance = account_balance - ? WHERE id = ?', [amountFromBalance, subscription.customer_id]);
                            await databasePool.execute('INSERT INTO payments (invoice_id, payment_method, amount, payment_date, gateway_status, notes, created_by, created_at) VALUES (?, "balance", ?, NOW(), "COMPLETED", "Otomatis potong saldo", 0, NOW())', [invoiceId, amountFromBalance]);
                        }

                        if (carryOverAmount > 0) {
                            await databasePool.execute('UPDATE carry_over_invoices SET status = "applied", applied_at = NOW() WHERE customer_id = ? AND target_period = ? AND status = "pending"', [subscription.customer_id, period]);
                        }
                    } catch (err) {
                        console.error(`[InvoiceService] Error subscription ${subscription.subscription_id}:`, err);
                    }
                }
            }

            // 2. Fallback: Customers WITHOUT active subscriptions processed in group 1
            console.log(`[InvoiceService] Checking for customers without active subscriptions for period: ${period}`);
            let customerQuery = `
                SELECT c.id as customer_id, c.name as customer_name, c.email, c.phone, c.account_balance, 
                       c.use_device_rental, c.is_taxable, c.rental_mode, c.rental_cost, c.created_at,
                       c.static_package_id, c.pppoe_package_id,
                       sp.price as static_price, sp.name as static_package_name,
                       pp.price as pppoe_price, pp.name as pppoe_package_name
                FROM customers c
                LEFT JOIN static_ip_packages sp ON c.static_package_id = sp.id
                LEFT JOIN pppoe_packages pp ON c.pppoe_package_id = pp.id
                WHERE c.status = 'active'
                AND c.id NOT IN (SELECT customer_id FROM invoices WHERE period = ?)
                AND c.id NOT IN (SELECT customer_id FROM subscriptions WHERE status = 'active')
            `;

            const customerParams: any[] = [period];

            if (!forceAll && !customerId) {
                customerQuery += ` AND DAY(c.created_at) = DAY(CURDATE()) `;
            }

            if (customerId) {
                customerQuery += ` AND c.id = ? `;
                customerParams.push(customerId);
            }

            const [customerResult] = await databasePool.query(customerQuery, customerParams);
            const customers = customerResult as any[];
            console.log(`[InvoiceService] Found ${customers.length} eligible customers without active subscriptions`);

            if (customers.length === 0 && customerId) {
                console.log(`[InvoiceService] ⚠️ Manual check: Customer ${customerId} was NOT found in fallback group. Checking why...`);
                const [check] = await databasePool.query(`
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
                    let dueDate: Date;

                    if (useFixedDay) {
                        const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
                        const targetDay = Math.min(fixedDay, daysInMonth);
                        dueDate = new Date(periodYear, periodMonth - 1, targetDay);
                    } else {
                        dueDate = new Date(periodYear, periodMonth - 1, 1);
                        dueDate.setDate(dueDate.getDate() + dayOffset);
                    }

                    // Fallback price logic: Prefer static package, then pppoe package, then default to 100k
                    let subtotal = 100000;
                    let packageName = 'Internet';

                    if (customer.static_package_id && customer.static_price) {
                        subtotal = Number(customer.static_price);
                        packageName = customer.static_package_name;
                    } else if (customer.pppoe_package_id && customer.pppoe_price) {
                        subtotal = Number(customer.pppoe_price);
                        packageName = customer.pppoe_package_name;
                    }

                    let deviceFee = 0;
                    if (deviceRentalEnabled && customer.use_device_rental) {
                        const rentalCost = customer.rental_cost !== null && customer.rental_cost !== undefined ? Number(customer.rental_cost) : Number(deviceRentalFee);
                        const rentalMode = customer.rental_mode || 'flat';
                        if (rentalMode === 'daily') {
                            const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
                            deviceFee = rentalCost * daysInMonth;
                        } else {
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
                        await databasePool.execute('UPDATE customers SET account_balance = account_balance - ? WHERE id = ?', [amountFromBalance, customer.customer_id]);
                        await databasePool.execute('INSERT INTO payments (invoice_id, payment_method, amount, payment_date, notes) VALUES (?, "balance", ?, NOW(), "Otomatis potong saldo")', [invoiceId, amountFromBalance]);
                    }
                } catch (err) {
                    console.error(`[InvoiceService] Error fallback customer ${customer.customer_id}:`, err);
                }
            }

        } catch (error) {
            console.error('[InvoiceService] Error in generateMonthlyInvoices:', error);
            console.error('[InvoiceService] Error stack:', (error as Error).stack);
            throw error;
        }

        console.log(`[InvoiceService] Completed generateMonthlyInvoices for period ${period}. Created ${invoiceIds.length} invoices.`);
        return invoiceIds;
    }

    /**
     * Update status invoice
     */
    static async updateInvoiceStatus(invoiceId: number, status: string): Promise<void> {
        const query = `
            UPDATE invoices 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;

        await databasePool.query(query, [status, invoiceId]);
    }

    /**
     * Get invoice by ID
     */
    static async getInvoiceById(invoiceId: number) {
        const query = `
            SELECT i.*, c.name as customer_name, c.email, c.phone, c.address,
                   c.odc_id, odc.name as odc_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN odc ON c.odc_id = odc.id
            WHERE i.id = ?
        `;

        const [result] = await databasePool.query(query, [invoiceId]);
        return (result as any)[0];
    }

    /**
     * Get invoice items
     */
    static async getInvoiceItems(invoiceId: number) {
        const query = `
            SELECT * FROM invoice_items 
            WHERE invoice_id = ? 
            ORDER BY id
        `;

        const [result] = await databasePool.query(query, [invoiceId]);
        return result as any[];
    }

    /**
     * Get invoices dengan filter
     */
    static async getInvoices(filters: {
        status?: string;
        period?: string;
        odc_id?: number;
        customer_id?: number;
        limit?: number;
        offset?: number;
    } = {}) {
        let query = `
            SELECT i.*, c.name as customer_name, c.phone, c.email,
                   ftth_odc.name as odc_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN ftth_odc ON c.odc_id = ftth_odc.id
            WHERE 1=1
        `;

        const params: any[] = [];

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

        const [result] = await databasePool.query(query, params);
        return result as any[];
    }

    /**
     * Mark invoice as sent
     */
    static async markAsSent(invoiceId: number): Promise<void> {
        await this.updateInvoiceStatus(invoiceId, 'sent');
    }

    /**
     * Get overdue invoices
     */
    static async getOverdueInvoices(): Promise<any[]> {
        const query = `
            SELECT i.*, c.name as customer_name, c.phone, c.email,
                   odc.name as odc_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN odc ON c.odc_id = odc.id
            WHERE i.status IN ('sent', 'partial') 
            AND i.due_date < CURRENT_DATE
            ORDER BY i.due_date ASC
        `;

        const [result] = await databasePool.query(query);
        return result as any[];
    }

    /**
     * Bulk delete invoices
     */
    static async bulkDeleteInvoices(invoiceIds: number[]): Promise<{
        deleted: number;
        failed: number;
        errors: string[];
    }> {
        const connection = await databasePool.getConnection();
        const result = {
            deleted: 0,
            failed: 0,
            errors: [] as string[]
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
                    const invoice = (checkResult as any)[0];

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
                    const paymentCount = parseInt((paymentResult as any)[0].payment_count);
                    const totalPaid = parseFloat((paymentResult as any)[0].total_paid) || 0;

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

                } catch (error: any) {
                    console.error(`Error deleting invoice ${invoiceId}:`, error);
                    result.failed++;
                    result.errors.push(`Error menghapus invoice ${invoiceId}: ${error.message}`);
                }
            }

            await connection.commit();
            return result;

        } catch (error: any) {
            console.error('Error in bulk delete transaction:', error);
            await connection.rollback();
            throw new Error(`Bulk delete failed: ${error.message}`);
        } finally {
            connection.release();
        }
    }

    /**
     * Delete single invoice
     */
    static async deleteInvoice(invoiceId: number): Promise<{
        success: boolean;
        message: string;
    }> {
        try {
            // Check if invoice exists
            const checkQuery = `
                SELECT i.id, i.status, c.name as customer_name
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `;

            const [checkResult] = await databasePool.query(checkQuery, [invoiceId]);
            const invoice = (checkResult as any)[0];

            if (!invoice) {
                return { success: false, message: 'Invoice tidak ditemukan' };
            }

            // Check if invoice has payments - but allow deletion with warning
            const paymentQuery = `
                SELECT COUNT(*) as payment_count, SUM(amount) as total_paid
                FROM payments 
                WHERE invoice_id = ?
            `;

            const [paymentResult] = await databasePool.query(paymentQuery, [invoiceId]);
            const paymentCount = parseInt((paymentResult as any)[0].payment_count);
            const totalPaid = parseFloat((paymentResult as any)[0].total_paid) || 0;

            const connection = await databasePool.getConnection();
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

            } finally {
                connection.release();
            }

        } catch (error: any) {
            return {
                success: false,
                message: `Error menghapus invoice: ${error.message}`
            };
        }
    }
}
