import { databasePool } from '../../db/pool';

export interface InvoiceData {
    customer_id: number;
    subscription_id?: number;
    period: string;
    due_date: string;
    subtotal: number;
    discount_amount?: number;
    total_amount: number;
    notes?: string;
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
                    due_date, subtotal, discount_amount, total_amount, 
                    remaining_amount, status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [invoiceResult] = await connection.execute(invoiceQuery, [
                invoiceNumber,
                invoiceData.customer_id || 0,
                invoiceData.subscription_id || 0,
                invoiceData.period || '2025-01',
                invoiceData.due_date || new Date().toISOString().split('T')[0],
                invoiceData.subtotal || 0,
                invoiceData.discount_amount || 0,
                invoiceData.total_amount || 0,
                invoiceData.total_amount || 0,
                'draft',
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
    static async generateMonthlyInvoices(period: string): Promise<number[]> {
        const periodDate = new Date(period + '-01');
        const invoiceIds: number[] = [];

        console.log(`[InvoiceService] Starting generateMonthlyInvoices for period: ${period}`);
        console.log(`[InvoiceService] Period date: ${periodDate.toISOString()}`);

        try {
            // Cek apakah periode valid
            if (isNaN(periodDate.getTime())) {
                throw new Error(`Periode tidak valid: ${period}`);
            }

            // Coba dengan tabel subscriptions terlebih dahulu
            // Generate invoice berdasarkan DAY(start_date) untuk billing mengikuti tanggal daftar
            let subscriptionQuery = `
                SELECT s.id as subscription_id, s.customer_id, s.package_name, s.price,
                       c.name as customer_name, c.email, c.phone, s.start_date,
                       DAY(s.start_date) as billing_day
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                WHERE s.status = 'active' 
                AND (s.end_date IS NULL OR s.end_date >= CURDATE())
                AND DAY(s.start_date) = DAY(CURDATE())  -- Generate invoice pada tanggal yang sama dengan tanggal daftar
                AND s.customer_id NOT IN (
                    SELECT DISTINCT customer_id 
                    FROM invoices 
                    WHERE period = ?
                )
            `;

            console.log(`[InvoiceService] Executing subscription query for period: ${period}`);
            const [subscriptionResult] = await databasePool.query(subscriptionQuery, [period]);
            console.log(`[InvoiceService] Found ${(subscriptionResult as any[]).length} subscriptions`);

            if ((subscriptionResult as any[]).length > 0) {
                // Generate dari subscriptions
                console.log(`[InvoiceService] Processing ${(subscriptionResult as any[]).length} subscriptions`);
                for (const subscription of subscriptionResult as any[]) {
                    try {
                        console.log(`[InvoiceService] Processing subscription: ${subscription.subscription_id} for customer: ${subscription.customer_name}`);

                        // Jatuh tempo: tanggal 28 bulan ini
                        const periodYear = parseInt(period.split('-')[0] || new Date().getFullYear().toString());
                        const periodMonth = parseInt(period.split('-')[1] || (new Date().getMonth() + 1).toString());
                        const dueDate = new Date(periodYear, periodMonth - 1, 28); // Tanggal 28 bulan invoice

                        // Check for carry over amount (with error handling)
                        let carryOverAmount = 0;
                        try {
                            const carryOverQuery = `
                                SELECT COALESCE(SUM(carry_over_amount), 0) as carry_over_amount
                                FROM carry_over_invoices 
                                WHERE customer_id = ? AND target_period = ? AND status = 'pending'
                            `;

                            const [carryOverResult] = await databasePool.query(carryOverQuery, [subscription.customer_id, period]);
                            carryOverAmount = parseFloat(((carryOverResult as any[])[0] as any).carry_over_amount || 0);
                        } catch (carryOverError) {
                            console.warn(`[InvoiceService] Warning: Could not check carry over for customer ${subscription.customer_name}:`, carryOverError);
                            carryOverAmount = 0;
                        }

                        const totalAmount = (subscription.price || 0) + carryOverAmount;

                        const invoiceData: InvoiceData = {
                            customer_id: subscription.customer_id || 0,
                            subscription_id: subscription.subscription_id || subscription.id || 0,
                            period: period,
                            due_date: dueDate.toISOString().split('T')[0] as string,
                            subtotal: subscription.price || 0,
                            total_amount: totalAmount,
                            discount_amount: 0,
                            notes: carryOverAmount > 0 ? `Include carry over: Rp ${carryOverAmount.toLocaleString('id-ID')}` : undefined
                        };

                        const items: InvoiceItem[] = [{
                            description: `Paket ${subscription.package_name || 'Unknown Package'} - ${period}`,
                            quantity: 1,
                            unit_price: subscription.price || 0,
                            total_price: subscription.price || 0
                        }];

                        // Add carry over item if exists
                        if (carryOverAmount > 0) {
                            items.push({
                                description: `Sisa Hutang Bulan Sebelumnya - ${period}`,
                                quantity: 1,
                                unit_price: carryOverAmount,
                                total_price: carryOverAmount
                            });
                        }

                        console.log(`[InvoiceService] Creating invoice for customer ${subscription.customer_name} with amount ${totalAmount} (base: ${subscription.price}, carry over: ${carryOverAmount})`);
                        const invoiceId = await this.createInvoice(invoiceData, items);
                        console.log(`[InvoiceService] Created invoice with ID: ${invoiceId}`);
                        invoiceIds.push(invoiceId);

                        // Mark carry over as applied if exists
                        if (carryOverAmount > 0) {
                            try {
                                await databasePool.execute(
                                    'UPDATE carry_over_invoices SET status = "applied", applied_at = NOW() WHERE customer_id = ? AND target_period = ? AND status = "pending"',
                                    [subscription.customer_id, period]
                                );
                                console.log(`[InvoiceService] Marked carry over as applied for customer ${subscription.customer_name}`);
                            } catch (carryOverUpdateError) {
                                console.warn(`[InvoiceService] Warning: Could not update carry over status for customer ${subscription.customer_name}:`, carryOverUpdateError);
                            }
                        }
                    } catch (subscriptionError) {
                        console.error(`[InvoiceService] Error processing subscription ${subscription.subscription_id}:`, subscriptionError);
                        // Continue with next subscription
                        continue;
                    }
                }
            } else {
                // Fallback: Generate dari customers dengan paket default
                console.log(`[InvoiceService] No subscriptions found, trying fallback with customers`);
                let customerResult: any[] = [];

                // Coba query dengan kolom status terlebih dahulu
                try {
                    const customerQueryWithStatus = `
                        SELECT c.id as customer_id, c.name as customer_name, c.email, c.phone
                        FROM customers c
                        WHERE c.status = 'active'
                        AND c.id NOT IN (
                            SELECT DISTINCT customer_id 
                            FROM invoices 
                            WHERE period = ?
                        )
                    `;
                    const [resWithStatus] = await databasePool.query(customerQueryWithStatus, [period]);
                    customerResult = resWithStatus as any[];
                } catch (e) {
                    console.warn('[InvoiceService] Warning: customers.status column may not exist, falling back without status filter');
                }

                // Jika hasil masih kosong, coba tanpa filter status
                if (!Array.isArray(customerResult) || customerResult.length === 0) {
                    const customerQueryNoStatus = `
                        SELECT c.id as customer_id, c.name as customer_name, c.email, c.phone
                        FROM customers c
                        WHERE c.id NOT IN (
                            SELECT DISTINCT customer_id 
                            FROM invoices 
                            WHERE period = ?
                        )
                    `;
                    const [resNoStatus] = await databasePool.query(customerQueryNoStatus, [period]);
                    customerResult = resNoStatus as any[];
                }

                console.log(`[InvoiceService] Found ${Array.isArray(customerResult) ? customerResult.length : 0} customers for fallback`);

                const defaultPrice = 100000; // Harga default jika tidak ada paket

                for (const customer of customerResult as any[]) {
                    try {
                        // Jatuh tempo: tanggal 28 bulan ini
                        const periodYear = parseInt(period.split('-')[0] || new Date().getFullYear().toString());
                        const periodMonth = parseInt(period.split('-')[1] || (new Date().getMonth() + 1).toString());
                        const dueDate = new Date(periodYear, periodMonth - 1, 28); // Tanggal 28 bulan invoice

                        const invoiceData: InvoiceData = {
                            customer_id: customer.customer_id || 0,
                            period: period,
                            due_date: dueDate.toISOString().split('T')[0] as string,
                            subtotal: defaultPrice,
                            total_amount: defaultPrice,
                            discount_amount: 0,
                            notes: 'Tagihan bulanan default'
                        };

                        const items: InvoiceItem[] = [{
                            description: `Paket Internet Bulanan - ${period}`,
                            quantity: 1,
                            unit_price: defaultPrice,
                            total_price: defaultPrice
                        }];

                        const invoiceId = await this.createInvoice(invoiceData, items);
                        invoiceIds.push(invoiceId);
                        console.log(`[InvoiceService] Created fallback invoice for customer ${customer.customer_name} with ID: ${invoiceId}`);
                    } catch (customerError) {
                        console.error(`[InvoiceService] Error processing customer ${customer.customer_name}:`, customerError);
                        // Continue with next customer
                        continue;
                    }
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
