import { SLARebateService } from './SLARebateService';
import { databasePool } from '../../db/pool';
import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

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
    static async generateInvoiceNumber(period: string, existingConnection?: PoolConnection | Pool): Promise<string> {
        const connection = existingConnection || databasePool;
        const year = period.split('-')[0];
        const month = period.split('-')[1];

        const query = `
            SELECT MAX(CAST(SUBSTRING_INDEX(invoice_number, '/', -1) AS UNSIGNED)) as max_seq
            FROM invoices 
            WHERE invoice_number LIKE ?
        `;

        const pattern = `INV/${year}/${month}/%`;
        const [result] = await (connection as Pool).query<RowDataPacket[]>(query, [pattern]);
        const count = ((result[0] as any).max_seq || 0) + 1;

        return `INV/${year}/${month}/${count.toString().padStart(4, '0')}`;
    }

    /**
     * Buat invoice baru
     */
    static async createInvoice(invoiceData: InvoiceData, items: InvoiceItem[], existingConnection?: PoolConnection | Pool): Promise<number> {
        const connection = existingConnection || await databasePool.getConnection();
        const isNewConnection = !existingConnection;

        try {
            if (isNewConnection) await (connection as PoolConnection).beginTransaction();

            // Generate nomor invoice
            const invoiceNumber = await this.generateInvoiceNumber(invoiceData.period, connection);

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

            if (isNewConnection) await (connection as PoolConnection).commit();

            /*
            if (status === 'sent') {
                try {
                    const { UnifiedNotificationService } = await import('../../services/notification/UnifiedNotificationService');
                    UnifiedNotificationService.notifyInvoiceCreated(invoiceId).catch(e => console.error(e));
                } catch (notifError) {
                    console.error('Error sending invoice created notification:', notifError);
                }
            }
            */
            return invoiceId;
        } catch (error) {
            if (isNewConnection) await (connection as PoolConnection).rollback();
            throw error;
        } finally {
            if (isNewConnection) (connection as PoolConnection).release();
        }
    }

    /**
     * Handle partial payment dengan debt tracking
     */
    static async handlePartialPayment(invoiceId: number, paymentAmount: number, paymentMethod: string, notes?: string, existingConnection?: PoolConnection | Pool): Promise<{ success: boolean, message: string, remainingAmount?: number }> {
        const connection = existingConnection || await databasePool.getConnection();
        const isNewConnection = !existingConnection;

        try {
            if (isNewConnection) {
                await (connection as PoolConnection).execute('SET innodb_lock_wait_timeout = 30');
                await (connection as PoolConnection).beginTransaction();
            }

            // Get invoice details
            const [invoiceRows] = await connection.execute<RowDataPacket[]>(
                'SELECT total_amount, customer_id, period FROM invoices WHERE id = ? FOR UPDATE',
                [invoiceId]
            );

            if (invoiceRows.length === 0) {
                throw new Error('Invoice not found');
            }

            const invoice = invoiceRows[0];
            const totalAmount = parseFloat(invoice.total_amount);
            const customerId = invoice.customer_id;
            const period = invoice.period;

            // Get current paid amount
            const [paymentRows] = await connection.execute<RowDataPacket[]>(
                'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = ?',
                [invoiceId]
            );

            const currentPaid = parseFloat(paymentRows[0].total_paid);
            const newPaidAmount = currentPaid + paymentAmount;
            const remainingAmount = totalAmount - newPaidAmount;

            // Record payment
            await connection.execute(
                'INSERT INTO payments (invoice_id, payment_method, amount, notes, created_at) VALUES (?, ?, ?, ?, NOW())',
                [invoiceId, paymentMethod, paymentAmount, notes || 'Partial payment']
            );

            // Update invoice status
            let newStatus = 'partial';
            if (newPaidAmount >= totalAmount) {
                newStatus = 'paid';
            }

            await connection.execute(
                'UPDATE invoices SET paid_amount = ?, remaining_amount = ?, status = ?, last_payment_date = NOW(), updated_at = NOW() WHERE id = ?',
                [newPaidAmount, remainingAmount, newStatus, invoiceId]
            );

            // Create debt tracking and carry over if needed
            if (remainingAmount > 0) {
                await connection.execute(
                    'INSERT INTO debt_tracking (customer_id, invoice_id, debt_amount, debt_reason, status) VALUES (?, ?, ?, ?, "active")',
                    [customerId, invoiceId, remainingAmount, `Partial payment - remaining balance for period ${period}`]
                );

                const nextPeriod = this.getNextPeriod(period);
                await connection.execute(
                    'INSERT INTO carry_over_invoices (customer_id, carry_over_amount, target_period, status) VALUES (?, ?, ?, "pending")',
                    [customerId, remainingAmount, nextPeriod]
                );
            }

            if (isNewConnection) await (connection as PoolConnection).commit();

            return {
                success: true,
                message: `Payment recorded successfully. ${remainingAmount > 0 ? `Remaining amount: Rp ${remainingAmount.toLocaleString('id-ID')}` : 'Invoice fully paid!'}`,
                remainingAmount: remainingAmount > 0 ? remainingAmount : 0
            };

        } catch (error) {
            if (isNewConnection) await (connection as PoolConnection).rollback();
            console.error('Error handling partial payment:', error);
            return {
                success: false,
                message: `Error processing payment: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        } finally {
            if (isNewConnection) (connection as PoolConnection).release();
        }
    }

    private static getNextPeriod(currentPeriod: string): string {
        const [year, month] = currentPeriod.split('-');
        const currentDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        return `${nextDate.getFullYear()}-${(nextDate.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    /**
     * Process daily auto-pay for admin managed customers
     */
    static async processAutoPayAdmin(): Promise<{ paid: number, failed: number }> {
        const connection = await databasePool.getConnection();
        let paid = 0;
        let failed = 0;

        try {
            await connection.beginTransaction();
            
            // Find unpaid invoices for customers who have auto_pay enabled and whose auto_pay date matches today
            const currentDay = new Date().getDate();
            const query = `
                SELECT i.id as invoice_id, i.remaining_amount, c.id as customer_id, c.name
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE c.auto_pay_enabled = 1
                AND c.auto_pay_date = ?
                AND i.status IN ('sent', 'partial', 'overdue')
                AND i.remaining_amount > 0
            `;

            const [invoicesToPay] = await connection.query<RowDataPacket[]>(query, [currentDay]);

            for (const inv of invoicesToPay) {
                try {
                    const invoiceId = inv.invoice_id;
                    const amountToPay = parseFloat(inv.remaining_amount);
                    
                    // Auto payment simulates a Cash payment done by Admin
                    const notes = 'Auto-Lunas Admin (System)';
                    const paymentResult = await this.handlePartialPayment(invoiceId, amountToPay, 'Cash', notes, connection);
                    
                    if (paymentResult.success) {
                        paid++;
                    } else {
                        failed++;
                        console.error(`[Auto-Pay] Failed to auto-pay invoice ${invoiceId}: ${paymentResult.message}`);
                    }
                } catch (paymentErr) {
                    failed++;
                    console.error(`[Auto-Pay] Error auto-paying invoice ${inv.invoice_id}:`, paymentErr);
                }
            }

            await connection.commit();
            return { paid, failed };
        } catch (error) {
            await connection.rollback();
            console.error('[Auto-Pay] DB error during processAutoPayAdmin:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static getMonthName(period: string): string {
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        if (!period) return period;
        const [year, month] = period.split('-');
        const monthNum = parseInt(month, 10) - 1;
        if (monthNum >= 0 && monthNum <= 11) {
            return `${months[monthNum]} ${year}`;
        }
        return period;
    }

    /**
     * Generate invoice otomatis
     */
    static async generateMonthlyInvoices(period: string, customerIds?: number | number[], forceAll: boolean = false): Promise<number[]> {
        const periodDate = new Date(period + '-01');
        const invoiceIds: number[] = [];

        if (isNaN(periodDate.getTime())) {
            throw new Error(`Periode tidak valid: ${period}`);
        }

        const connection = await databasePool.getConnection();

        try {
            await connection.execute('SET innodb_lock_wait_timeout = 60');

            // Get System Settings
            const { SettingsService } = await import('../../services/SettingsService');
            const ppnEnabled = await SettingsService.getBoolean('ppn_enabled');
            const ppnRate = ppnEnabled ? await SettingsService.getNumber('ppn_rate') : 0;
            const deviceRentalEnabled = await SettingsService.getBoolean('device_rental_enabled');
            const deviceRentalFee = await SettingsService.getNumber('device_rental_fee');

            // 1. Process active subscriptions
            let subscriptionQuery = `
                SELECT s.id as subscription_id, s.customer_id, s.package_name, s.price,
                       c.name as customer_name, c.email, c.phone, COALESCE(s.activation_date, s.start_date) as start_date,
                       DAY(COALESCE(s.activation_date, s.start_date)) as billing_day, c.account_balance, c.use_device_rental, c.is_taxable,
                       c.customer_code, c.rental_mode, c.rental_cost,
                       c.custom_payment_deadline, c.custom_isolate_days_after_deadline, c.loyalty_discount
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                WHERE s.status = 'active' 
                AND c.status = 'active'
            `;

            const queryParams: any[] = [];
            if (!forceAll && !customerIds) {
                // Modified: check for current day and past days to catch up, up to H-7
                // And filter out technically expired end_dates only for auto-scheduler
                subscriptionQuery += ` 
                    AND (s.end_date IS NULL OR s.end_date >= CURDATE())
                    AND DAY(COALESCE(s.activation_date, s.start_date)) <= DAY(DATE_ADD(CURDATE(), INTERVAL 7 DAY)) 
                `;
            }

            if (customerIds) {
                if (Array.isArray(customerIds)) {
                    if (customerIds.length > 0) {
                        subscriptionQuery += ` AND s.customer_id IN (?) `;
                        queryParams.push(customerIds);
                    }
                } else {
                    subscriptionQuery += ` AND s.customer_id = ? `;
                    queryParams.push(customerIds);
                }
            }

            subscriptionQuery += `
                AND s.id NOT IN (
                    SELECT DISTINCT subscription_id 
                    FROM invoices 
                    WHERE period = ? AND subscription_id IS NOT NULL
                )
            `;
            queryParams.push(period);

            const [subscriptions] = await connection.query<RowDataPacket[]>(subscriptionQuery, queryParams);

            for (const subscription of subscriptions) {
                try {
                    // Calculate Due Date
                    const periodYear = parseInt(period.split('-')[0]);
                    const periodMonth = parseInt(period.split('-')[1]);
                    // Prioritize custom_payment_deadline if set (1-31)
                    const billingDay = subscription.custom_payment_deadline || subscription.billing_day || new Date(subscription.start_date).getDate();
                    const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
                    const targetDay = Math.min(billingDay, daysInMonth);
                    const dueDate = new Date(periodYear, periodMonth - 1, targetDay);

                    // Start transaction for each invoice to minimize lock time
                    await connection.beginTransaction();

                    // Carry Over: Pick up ALL pending debt for this customer up to this period (both full and partial)
                    const [oldInvoices] = await connection.query<RowDataPacket[]>(
                        `SELECT id, period, paid_amount, remaining_amount, status, notes
                         FROM invoices 
                         WHERE customer_id = ? AND period < ? AND remaining_amount > 0 AND status NOT IN ('cancelled', 'paid')`,
                        [subscription.customer_id, period]
                    );

                    let carryOverAmount = 0;
                    const oldInvoiceIds: number[] = [];
                    const carryOverItems: InvoiceItem[] = [];

                    for (const oldInv of oldInvoices) {
                        const remAmt = parseFloat(oldInv.remaining_amount);
                        carryOverAmount += remAmt;
                        oldInvoiceIds.push(oldInv.id);
                        
                        const monthName = InvoiceService.getMonthName(oldInv.period);
                        const isPartial = parseFloat(oldInv.paid_amount) > 0;
                        const desc = isPartial ? `Kekurangan Tagihan Bulan ${monthName}` : `Tunggakan Tagihan Bulan ${monthName}`;
                        
                        carryOverItems.push({
                            description: desc,
                            quantity: 1,
                            unit_price: remAmt,
                            total_price: remAmt
                        });
                    }

                    // SLA Rebate
                    const prevDate = new Date(periodYear, periodMonth - 2, 1);
                    const prevPeriod = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
                    let slaRebateAmount = 0;
                    let slaReason = '';
                    try {
                        const rebate = await SLARebateService.calculateRebate(subscription.customer_id, prevPeriod);
                        if (rebate.isEligible && rebate.rebateAmount > 0) {
                            slaRebateAmount = rebate.rebateAmount;
                            slaReason = rebate.reason;
                        }
                    } catch (e) { }

                    // Compensations
                    const [compRows] = await connection.query<RowDataPacket[]>(
                        `SELECT id, duration_days, amount, notes FROM customer_compensations WHERE customer_id = ? AND status = 'pending' FOR UPDATE`,
                        [subscription.customer_id]
                    );
                    const compensationTotal = (compRows as any[]).reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

                    const baseSubtotal = parseFloat(subscription.price || 0);
                    let deviceFee = 0;
                    if (deviceRentalEnabled && subscription.use_device_rental) {
                        const rentalCost = subscription.rental_cost != null ? Number(subscription.rental_cost) : Number(deviceRentalFee);
                        deviceFee = (subscription.rental_mode === 'daily') ? rentalCost * daysInMonth : rentalCost;
                    }

                    const totalDiscount = slaRebateAmount + compensationTotal;
                    let ppnAmount = 0;
                    if (ppnEnabled && ppnRate > 0 && subscription.is_taxable) {
                        ppnAmount = Math.round(Math.max(0, baseSubtotal + deviceFee - totalDiscount) * (ppnRate / 100));
                    }

                    const loyaltyDiscountTotal = parseFloat(subscription.loyalty_discount || 0);
                    const totalAmount = Math.max(0, baseSubtotal + deviceFee + ppnAmount + carryOverAmount - totalDiscount - loyaltyDiscountTotal);
                    const amountFromBalance = Math.min(parseFloat(subscription.account_balance || 0), totalAmount);

                    const items: InvoiceItem[] = [
                        { description: `Paket ${subscription.package_name || 'Internet'} - ${period}`, quantity: 1, unit_price: baseSubtotal, total_price: baseSubtotal }
                    ];

                    if (loyaltyDiscountTotal > 0) {
                        items.push({ 
                            description: `Bonus Loyalitas (Potongan Selamanya)`, 
                            quantity: 1, 
                            unit_price: -loyaltyDiscountTotal, 
                            total_price: -loyaltyDiscountTotal 
                        });
                    }

                    if (deviceFee > 0) items.push({ description: `Sewa Perangkat - ${period}`, quantity: 1, unit_price: deviceFee, total_price: deviceFee });
                    if (carryOverAmount > 0) items.push(...carryOverItems);
                    if (slaRebateAmount > 0) items.push({ description: slaReason || `SLA Rebate - ${prevPeriod}`, quantity: 1, unit_price: -slaRebateAmount, total_price: -slaRebateAmount });
                    for (const comp of compRows) {
                        items.push({ description: `Restitusi Gangguan (${comp.duration_days} Hari) - ${comp.notes || ''}`, quantity: 1, unit_price: -parseFloat(comp.amount), total_price: -parseFloat(comp.amount) });
                    }

                    const yearStr = dueDate.getFullYear();
                    const monthStr = String(dueDate.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(dueDate.getDate()).padStart(2, '0');
                    const dueDateString = `${yearStr}-${monthStr}-${dayStr}`;

                    const invoiceId = await this.createInvoice({
                        customer_id: subscription.customer_id,
                        subscription_id: subscription.subscription_id,
                        period,
                        due_date: dueDateString,
                        subtotal: baseSubtotal,
                        ppn_rate: ppnEnabled ? ppnRate : 0,
                        ppn_amount: ppnAmount,
                        device_fee: deviceFee,
                        total_amount: totalAmount,
                        paid_amount: amountFromBalance,
                        discount_amount: totalDiscount + loyaltyDiscountTotal,
                        notes: (carryOverAmount > 0 ? `Include carry over: Rp ${carryOverAmount.toLocaleString('id-ID')}` : 'Tagihan Bulanan') + 
                               (loyaltyDiscountTotal > 0 ? ` + Loyalty: Rp ${loyaltyDiscountTotal.toLocaleString('id-ID')}` : '')
                    }, items, connection);

                    if (loyaltyDiscountTotal > 0) {
                        await connection.query(
                            'INSERT INTO discounts (invoice_id, discount_type, discount_value, reason, created_at) VALUES (?, "loyalty", ?, "Potongan Loyalitas Selamanya", NOW())',
                            [invoiceId, loyaltyDiscountTotal]
                        );
                    }

                    invoiceIds.push(invoiceId);
                    // Update related records
                    if (compRows.length > 0) {
                        await connection.query(`UPDATE customer_compensations SET status = 'applied', applied_invoice_id = ?, applied_at = NOW() WHERE id IN (?)`, [invoiceId, compRows.map(c => c.id)]);
                    }
                    if (amountFromBalance > 0) {
                        await connection.execute('UPDATE customers SET account_balance = account_balance - ? WHERE id = ?', [amountFromBalance, subscription.customer_id]);
                        await connection.execute('INSERT INTO payments (invoice_id, payment_method, amount, payment_date, gateway_status, notes, created_by, created_at) VALUES (?, "balance", ?, NOW(), "COMPLETED", "Otomatis potong saldo", 0, NOW())', [invoiceId, amountFromBalance]);
                    }
                    if (carryOverAmount > 0 && oldInvoiceIds.length > 0) {
                        // 4. Update source invoices for carry-over debt to prevent double listing
                        try {
                            const [existingNotesResult] = await connection.query<RowDataPacket[]>('SELECT id, notes FROM invoices WHERE id IN (?)', [oldInvoiceIds]);
                            // We need to update note per old invoice to avoid overwriting them all with same string
                            for(const inv of existingNotesResult) {
                                const newNote = (inv.notes || '') + `\n[CARRIED OVER to Period ${period} Invoice ${invoiceId}]`;
                                await connection.query(
                                    `UPDATE invoices SET status = 'paid', remaining_amount = 0, notes = ? WHERE id = ?`,
                                    [newNote, inv.id]
                                );
                            }

                            // Deactivate the old debt tracking since it's now applied to a NEW invoice (if any)
                            await connection.query(
                                'UPDATE debt_tracking SET status = "applied" WHERE invoice_id IN (?) AND status = "active"',
                                [oldInvoiceIds]
                            );

                            // We should also clear any carry_over_invoices related to this customer just to be safe
                            await connection.query(
                                'UPDATE carry_over_invoices SET status = "applied" WHERE customer_id = ? AND status = "pending"',
                                [subscription.customer_id]
                            );
                        } catch (debtUpdateErr) {
                            console.error(`[InvoiceService] Error updating source invoices:`, debtUpdateErr);
                        }
                    }


                    await connection.commit();
                } catch (err) {
                    await connection.rollback();
                    console.error(`Error processing subscription ${subscription.subscription_id}:`, err);
                }
            }

            // 2. Fallback customers (without active subscriptions)
            let customerQuery = `
                SELECT c.id as customer_id, c.loyalty_discount, c.name as customer_name, c.email, c.phone, c.account_balance, 
                       c.use_device_rental, c.is_taxable, c.rental_mode, c.rental_cost, c.created_at,
                       c.connection_type, c.custom_payment_deadline,
                       sp.name as static_pkg_name, sp.price as static_pkg_price,
                       pp.name as pppoe_pkg_name, pp.price as pppoe_pkg_price
                FROM customers c
                LEFT JOIN static_ip_clients sip ON c.id = sip.customer_id
                LEFT JOIN static_ip_packages sp ON sip.package_id = sp.id
                LEFT JOIN pppoe_packages pp ON c.pppoe_profile_id = pp.profile_id
                WHERE c.status = 'active'
                AND c.is_isolated = FALSE
                AND c.id NOT IN (SELECT customer_id FROM invoices WHERE period = ?)
                AND c.id NOT IN (SELECT customer_id FROM subscriptions)
            `;
            const customerParams: any[] = [period];
            if (!forceAll && !customerIds) {
                customerQuery += ` AND DAY(c.created_at) <= DAY(DATE_ADD(CURDATE(), INTERVAL 7 DAY)) `;
            }
            if (customerIds) {
                if (Array.isArray(customerIds)) {
                    if (customerIds.length > 0) {
                        customerQuery += ` AND c.id IN (?) `;
                        customerParams.push(customerIds);
                    }
                } else {
                    customerQuery += ` AND c.id = ? `;
                    customerParams.push(customerIds);
                }
            }

            const [customerResult] = await connection.query<RowDataPacket[]>(customerQuery, customerParams);
            console.log(`[InvoiceService] Found ${customerResult.length} eligible customers without active subscriptions`);

            for (const customer of customerResult) {
                try {
                    await connection.beginTransaction();
                    const periodYear = parseInt(period.split('-')[0] || new Date().getFullYear().toString());
                    const periodMonth = parseInt(period.split('-')[1] || (new Date().getMonth() + 1).toString());

                    let baseDay = 1; // Default to 1 if we can't figure it out

                    if (customer.custom_payment_deadline) {
                        baseDay = customer.custom_payment_deadline;
                    } else if (customer.created_at) {
                        baseDay = new Date(customer.created_at).getDate();
                    }

                    const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
                    const targetDayFallback = Math.min(baseDay, daysInMonth);
                    const dueDate = new Date(periodYear, periodMonth - 1, targetDayFallback);

                    const yearStr = dueDate.getFullYear();
                    const monthStr = String(dueDate.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(dueDate.getDate()).padStart(2, '0');
                    const dueDateString = `${yearStr}-${monthStr}-${dayStr}`;

                    let subtotal = 0;
                    let packageName = 'Layanan Internet';

                    if (customer.connection_type === 'static_ip' && customer.static_pkg_price) {
                        subtotal = parseFloat(customer.static_pkg_price) || 0;
                        packageName = customer.static_pkg_name || 'Paket Static IP';
                    } else if (customer.connection_type === 'pppoe' && (customer.pppoe_pkg_price || customer.static_pkg_price)) {
                        // Sometimes PPPoE customers might be misconfigured but still have a static price if migrated
                        subtotal = parseFloat(customer.pppoe_pkg_price || customer.static_pkg_price) || 0;
                        packageName = customer.pppoe_pkg_name || customer.static_pkg_name || 'Paket PPPoE';
                    }

                    // Fallback to default if still 0
                    if (subtotal <= 0) {
                        subtotal = 100000;
                        packageName = 'Layanan Internet (Default)';
                    }

                    let deviceFee = 0;

                    if (deviceRentalEnabled && customer.use_device_rental) {
                        const rentalCost = customer.rental_cost != null ? Number(customer.rental_cost) : Number(deviceRentalFee);
                        deviceFee = (customer.rental_mode === 'daily') ? rentalCost * daysInMonth : rentalCost;
                    }

                    let ppnAmount = 0;
                    if (ppnEnabled && ppnRate > 0 && customer.is_taxable) {
                        ppnAmount = Math.round((subtotal + deviceFee) * (ppnRate / 100));
                    }

                    // Carry Over: Pick up ALL pending debt for this fallback customer up to this period (both full and partial)
                    const [oldInvoices] = await connection.query<RowDataPacket[]>(
                        `SELECT id, period, paid_amount, remaining_amount, status, notes
                         FROM invoices 
                         WHERE customer_id = ? AND period < ? AND remaining_amount > 0 AND status NOT IN ('cancelled', 'paid')`,
                        [customer.customer_id, period]
                    );

                    let carryOverAmount = 0;
                    const oldInvoiceIds: number[] = [];
                    const carryOverItems: InvoiceItem[] = [];

                    for (const oldInv of oldInvoices) {
                        const remAmt = parseFloat(oldInv.remaining_amount);
                        carryOverAmount += remAmt;
                        oldInvoiceIds.push(oldInv.id);
                        
                        const monthName = InvoiceService.getMonthName(oldInv.period);
                        const isPartial = parseFloat(oldInv.paid_amount) > 0;
                        const desc = isPartial ? `Kekurangan Tagihan Bulan ${monthName}` : `Tunggakan Tagihan Bulan ${monthName}`;
                        
                        carryOverItems.push({
                            description: desc,
                            quantity: 1,
                            unit_price: remAmt,
                            total_price: remAmt
                        });
                    }

                    const loyaltyDiscountFallback = parseFloat(customer.loyalty_discount || 0);
                    const totalAmount = Math.max(0, subtotal + deviceFee + ppnAmount + carryOverAmount - loyaltyDiscountFallback);
                    const customerBalance = parseFloat(customer.account_balance || 0);
                    const amountFromBalance = Math.min(customerBalance, totalAmount);
                    
                    const items: InvoiceItem[] = [{
                        description: `Layanan ${packageName} - ${period}`,
                        quantity: 1,
                        unit_price: subtotal,
                        total_price: subtotal
                    }];
                    if (carryOverAmount > 0) items.push(...carryOverItems);

                    const invoiceId = await this.createInvoice({
                        customer_id: customer.customer_id,
                        subscription_id: undefined,
                        period: period,
                        due_date: dueDateString,
                        subtotal: subtotal,
                        ppn_rate: ppnEnabled ? ppnRate : 0,
                        ppn_amount: ppnAmount,
                        device_fee: deviceFee,
                        total_amount: totalAmount,
                        paid_amount: amountFromBalance,
                        notes: carryOverAmount > 0 ? `Include carry over: Rp ${carryOverAmount.toLocaleString('id-ID')} (Customer Fallback)` : 'Tagihan bulanan (Customer Fallback)'
                    }, items, connection);

                    invoiceIds.push(invoiceId);

                    if (amountFromBalance > 0) {
                        await connection.execute('UPDATE customers SET account_balance = account_balance - ? WHERE id = ?', [amountFromBalance, customer.customer_id]);
                        await connection.execute('INSERT INTO payments (invoice_id, payment_method, amount, payment_date, gateway_status, notes, created_by, created_at) VALUES (?, "balance", ?, NOW(), "COMPLETED", "Otomatis potong saldo", 0, NOW())', [invoiceId, amountFromBalance]);
                    }

                    if (carryOverAmount > 0 && oldInvoiceIds.length > 0) {
                        // Update source invoices for carry-over debt to prevent double listing
                        try {
                            const [existingNotesResult] = await connection.query<RowDataPacket[]>('SELECT id, notes FROM invoices WHERE id IN (?)', [oldInvoiceIds]);
                            for(const inv of existingNotesResult) {
                                const newNote = (inv.notes || '') + `\n[CARRIED OVER to Period ${period} Invoice ${invoiceId}]`;
                                await connection.query(
                                    `UPDATE invoices SET status = 'paid', remaining_amount = 0, notes = ? WHERE id = ?`,
                                    [newNote, inv.id]
                                );
                            }

                            await connection.query(
                                'UPDATE debt_tracking SET status = "applied" WHERE invoice_id IN (?) AND status = "active"',
                                [oldInvoiceIds]
                            );

                            await connection.query(
                                'UPDATE carry_over_invoices SET status = "applied" WHERE customer_id = ? AND status = "pending"',
                                [customer.customer_id]
                            );
                        } catch (debtUpdateErr) {
                            console.error(`[InvoiceService] Error updating source invoices fallback:`, debtUpdateErr);
                        }
                    }

                    await connection.commit();
                } catch (err) {
                    await connection.rollback();
                    console.error(`[InvoiceService] Error fallback customer ${customer.customer_id}:`, err);
                }
            }
            return invoiceIds;
        } finally {
            connection.release();
        }
    }

    static async updateInvoiceStatus(invoiceId: number, status: string): Promise<void> {
        await databasePool.execute('UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ?', [status, invoiceId]);
    }

    static async getInvoiceById(invoiceId: number) {
        const query = `
            SELECT i.*, c.name as customer_name, c.email, c.phone, c.address,
                   c.odc_id, odc.name as odc_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
            WHERE i.id = ?
        `;
        const [result] = await databasePool.query(query, [invoiceId]);
        return (result as any[])[0];
    }

    static async getInvoiceItems(invoiceId: number) {
        const [result] = await databasePool.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [invoiceId]);
        return result as any[];
    }

    static async getInvoices(filters: any = {}) {
        let query = `SELECT i.*, c.name as customer_name, c.phone FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE 1=1`;
        const params: any[] = [];
        if (filters.status) { query += ` AND i.status = ?`; params.push(filters.status); }
        if (filters.period) { query += ` AND i.period = ?`; params.push(filters.period); }
        if (filters.customer_id) { query += ` AND i.customer_id = ?`; params.push(filters.customer_id); }
        query += ` ORDER BY i.created_at DESC`;
        if (filters.limit) { query += ` LIMIT ? OFFSET ?`; params.push(filters.limit, filters.offset || 0); }
        const [result] = await databasePool.query(query, params);
        return result as any[];
    }

    /**
     * Dapatkan tagihan yang sudah jatuh tempo
     */
    static async getOverdueInvoices(): Promise<any[]> {
        const [rows] = await databasePool.query(
            `SELECT i.*, c.name as customer_name, c.phone 
             FROM invoices i 
             JOIN customers c ON i.customer_id = c.id 
             WHERE i.status = 'overdue' AND i.remaining_amount > 0`
        );
        return rows as any[];
    }

    /**
     * Bulk delete invoices
     */
    static async bulkDeleteInvoices(invoiceIds: number[]): Promise<{ deleted: number; failed: number; errors: any[] }> {
        const connection = await databasePool.getConnection();
        let deleted = 0;
        let failed = 0;
        const errors: any[] = [];

        try {
            await connection.beginTransaction();

            for (const id of invoiceIds) {
                try {
                    // Cek apakah ada pembayaran
                    const [payments] = await connection.query<RowDataPacket[]>(
                        'SELECT id FROM payments WHERE invoice_id = ?', [id]
                    );

                    if (payments.length > 0) {
                        failed++;
                        errors.push({ id, message: 'Invoice sudah ada pembayaran (Batalkan pembayaran terlebih dahulu)' });
                        continue;
                    }

                    // Delete related records in specific order
                    await connection.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
                    await connection.execute('DELETE FROM discounts WHERE invoice_id = ?', [id]);
                    await connection.execute('DELETE FROM debt_tracking WHERE invoice_id = ?', [id]);

                    // Cleanup any notification queue entries
                    await connection.execute('DELETE FROM unified_notifications_queue WHERE invoice_id = ?', [id]);

                    // Delete invoice
                    const [result] = await connection.execute<ResultSetHeader>(
                        'DELETE FROM invoices WHERE id = ?', [id]
                    );

                    if (result.affectedRows > 0) {
                        deleted++;
                    } else {
                        failed++;
                        errors.push({ id, message: 'Invoice tidak ditemukan saat akan dihapus' });
                    }
                } catch (err: any) {
                    failed++;
                    console.error(`[BulkDelete] Error deleting invoice ${id}:`, err);
                    errors.push({ id, message: err.message });
                }
            }

            await connection.commit();
            return { deleted, failed, errors };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Set semua pelanggan aktif ke status "sent" (Pending) untuk periode tertentu
     */
    static async massPendingInvoices(period: string): Promise<{ created: number, updated: number, failed: number }> {
        const connection = await databasePool.getConnection();
        let created = 0;
        let updated = 0;
        let failed = 0;

        try {
            await connection.beginTransaction();

            // 1. Dapatkan semua pelanggan aktif
            const [customers] = await connection.query<RowDataPacket[]>(
                'SELECT id FROM customers WHERE status = "active"'
            );

            const customerIds = customers.map(c => c.id);
            if (customerIds.length === 0) return { created, updated, failed };

            // 2. Buat invoice yang belum ada (Force All untuk periode ini)
            const newInvoiceIds = await this.generateMonthlyInvoices(period, customerIds, true);
            created = newInvoiceIds.length;

            // 3. Pastikan semua invoice periode ini yang belum paid/cancelled menjadi 'sent'
            const [updateResult] = await connection.query<ResultSetHeader>(`
                UPDATE invoices 
                SET status = 'sent', updated_at = NOW() 
                WHERE period = ? 
                AND status NOT IN ('paid', 'cancelled')
            `, [period]);
            
            updated = updateResult.affectedRows;

            await connection.commit();
            return { created, updated, failed };
        } catch (error) {
            await connection.rollback();
            console.error('[InvoiceService] Error in massPendingInvoices:', error);
            throw error;
        } finally {
            connection.release();
        }
    }
}
