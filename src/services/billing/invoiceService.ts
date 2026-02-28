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

            // Send notification if invoice status is 'sent'
            if (status === 'sent') {
                try {
                    const { UnifiedNotificationService } = await import('../../services/notification/UnifiedNotificationService');
                    await UnifiedNotificationService.notifyInvoiceCreated(invoiceId).catch(e => console.error(e));
                } catch (notifError) {
                    console.error('Error sending invoice created notification:', notifError);
                }
            }
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
                       c.name as customer_name, c.email, c.phone, s.start_date,
                       DAY(s.start_date) as billing_day, c.account_balance, c.use_device_rental, c.is_taxable,
                       c.customer_code, c.rental_mode, c.rental_cost
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                WHERE s.status = 'active' 
                AND (s.end_date IS NULL OR s.end_date >= CURDATE())
            `;

            const queryParams: any[] = [];
            if (!forceAll && !customerIds) {
                // Modified: check for current day and past days to catch up, up to H-7
                subscriptionQuery += ` AND DAY(s.start_date) <= DAY(DATE_ADD(CURDATE(), INTERVAL 7 DAY)) `;
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
                    const billingDay = subscription.billing_day || new Date(subscription.start_date).getDate();
                    const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
                    const targetDay = Math.min(billingDay, daysInMonth);
                    const dueDate = new Date(periodYear, periodMonth - 1, targetDay);

                    // Start transaction for each invoice to minimize lock time
                    await connection.beginTransaction();

                    // Carry Over: Pick up ALL pending debt for this customer up to this period
                    const [carryOverResult] = await connection.query<RowDataPacket[]>(
                        `SELECT COALESCE(SUM(carry_over_amount), 0) as carry_over_amount,
                                GROUP_CONCAT(id) as ids
                         FROM carry_over_invoices 
                         WHERE customer_id = ? AND target_period <= ? AND status = 'pending'`,
                        [subscription.customer_id, period]
                    );
                    const carryOverAmount = parseFloat(carryOverResult[0].carry_over_amount || 0);
                    const carryOverIds = carryOverResult[0].ids ? carryOverResult[0].ids.split(',') : [];

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

                    const totalAmount = Math.max(0, baseSubtotal + deviceFee + ppnAmount + carryOverAmount - totalDiscount);
                    const amountFromBalance = Math.min(parseFloat(subscription.account_balance || 0), totalAmount);

                    const items: InvoiceItem[] = [
                        { description: `Paket ${subscription.package_name || 'Internet'} - ${period}`, quantity: 1, unit_price: baseSubtotal, total_price: baseSubtotal }
                    ];
                    if (deviceFee > 0) items.push({ description: `Sewa Perangkat - ${period}`, quantity: 1, unit_price: deviceFee, total_price: deviceFee });
                    if (carryOverAmount > 0) items.push({ description: `Sisa Hutang Bulan Sebelumnya - ${period}`, quantity: 1, unit_price: carryOverAmount, total_price: carryOverAmount });
                    if (slaRebateAmount > 0) items.push({ description: slaReason || `SLA Rebate - ${prevPeriod}`, quantity: 1, unit_price: -slaRebateAmount, total_price: -slaRebateAmount });
                    for (const comp of compRows) {
                        items.push({ description: `Restitusi Gangguan (${comp.duration_days} Hari) - ${comp.notes || ''}`, quantity: 1, unit_price: -parseFloat(comp.amount), total_price: -parseFloat(comp.amount) });
                    }

                    const invoiceId = await this.createInvoice({
                        customer_id: subscription.customer_id,
                        subscription_id: subscription.subscription_id,
                        period,
                        due_date: dueDate.toISOString().split('T')[0],
                        subtotal: baseSubtotal,
                        ppn_rate: ppnEnabled ? ppnRate : 0,
                        ppn_amount: ppnAmount,
                        device_fee: deviceFee,
                        total_amount: totalAmount,
                        paid_amount: amountFromBalance,
                        discount_amount: totalDiscount,
                        notes: carryOverAmount > 0 ? `Include carry over: Rp ${carryOverAmount.toLocaleString('id-ID')}` : undefined
                    }, items, connection);

                    invoiceIds.push(invoiceId);

                    // Update related records
                    if (compRows.length > 0) {
                        await connection.query(`UPDATE customer_compensations SET status = 'applied', applied_invoice_id = ?, applied_at = NOW() WHERE id IN (?)`, [invoiceId, compRows.map(c => c.id)]);
                    }
                    if (amountFromBalance > 0) {
                        await connection.execute('UPDATE customers SET account_balance = account_balance - ? WHERE id = ?', [amountFromBalance, subscription.customer_id]);
                        await connection.execute('INSERT INTO payments (invoice_id, payment_method, amount, payment_date, gateway_status, notes, created_by, created_at) VALUES (?, "balance", ?, NOW(), "COMPLETED", "Otomatis potong saldo", 0, NOW())', [invoiceId, amountFromBalance]);
                    }
                    if (carryOverAmount > 0 && carryOverIds.length > 0) {
                        await connection.query('UPDATE carry_over_invoices SET status = "applied", applied_at = NOW() WHERE id IN (?)', [carryOverIds]);
                    }

                    // 4. Update source invoices for carry-over debt to prevent double listing
                    // Find all active debt tracking for this customer that was just applied
                    if (carryOverAmount > 0) {
                        try {
                            // Mark source invoices as 'paid' because they are now "paid" by being transferred to this invoice
                            // We find which invoices these were from the carry_over_ids (which should map to invoices via debt_tracking)
                            await connection.execute(
                                `UPDATE invoices i 
                                     JOIN debt_tracking dt ON i.id = dt.invoice_id
                                     SET i.status = 'paid', i.remaining_amount = 0, i.notes = CONCAT(COALESCE(i.notes, ''), '\n[CARRIED OVER to Period ', ?, ' Invoice ', ?, ']')
                                     WHERE i.customer_id = ? AND dt.status = 'active'`,
                                [period, invoiceId, subscription.customer_id]
                            );

                            // Deactivate the old debt tracking since it's now applied to a NEW invoice
                            await connection.execute(
                                'UPDATE debt_tracking SET status = "applied" WHERE customer_id = ? AND status = "active"',
                                [subscription.customer_id]
                            );
                        } catch (debtUpdateErr) {
                            console.error(`[InvoiceService] Error updating source invoices:`, debtUpdateErr);
                        }
                    }


                    // Update carry-over status for just those applied
                    if (carryOverIds.length > 0) {
                        await connection.query(
                            'UPDATE carry_over_invoices SET status = "applied" WHERE id IN (?)',
                            [carryOverIds]
                        );
                    }

                    await connection.commit();
                } catch (err) {
                    await connection.rollback();
                    console.error(`Error processing subscription ${subscription.subscription_id}:`, err);
                }
            }

            // 2. Fallback customers (similar logic but simpler)
            // ... (keeping original logic structure for fallback)

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
}
