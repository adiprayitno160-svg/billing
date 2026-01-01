import { databasePool } from '../../db/pool';
import { UnifiedNotificationService } from '../notification/UnifiedNotificationService';
import { RowDataPacket } from 'mysql2';

export interface IsolationData {
    customer_id: number;
    action: 'isolate' | 'restore';
    reason: string;
    performed_by?: string;
}

export class IsolationService {
    /**
     * Isolir pelanggan
     */
    static async isolateCustomer(isolationData: IsolationData): Promise<boolean> {
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            // Security Check: Prevent manual restore if debt exists
            if (isolationData.action === 'restore' && isolationData.performed_by !== 'system') {
                const [unpaidCheck] = await connection.query<RowDataPacket[]>(
                    "SELECT COUNT(*) as count FROM invoices WHERE customer_id = ? AND status != 'paid'",
                    [isolationData.customer_id]
                );

                if (unpaidCheck.length > 0 && unpaidCheck[0].count > 0) {
                    throw new Error('BLOCKED: Pelanggan masih memiliki tagihan belum lunas. Admin tidak diizinkan membuka isolir manual. Wajib lunas via Transfer untuk verifikasi AI.');
                }
            }

            // Get customer details
            const customerQuery = `
                SELECT c.*, s.package_name, s.price
                FROM customers c
                LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                WHERE c.id = ?
            `;

            const [customerResult] = await connection.execute(customerQuery, [isolationData.customer_id]);
            const customer = (customerResult as any)[0];

            if (!customer) {
                throw new Error('Customer not found');
            }

            // Get MikroTik username (assuming it's stored in customer data or subscription)
            const mikrotikUsername = customer.phone || customer.email; // Adjust based on your setup
            let mikrotikResponse = '';
            let success = false;

            try {
                if (isolationData.action === 'isolate') {
                    // Move user to isolation profile or set queue limit to 0
                    // mikrotikResponse = await mikrotikService.isolateUser(mikrotikUsername);
                    mikrotikResponse = 'Simulated isolation';
                } else {
                    // Restore user to normal profile
                    // mikrotikResponse = await mikrotikService.restoreUser(mikrotikUsername);
                    mikrotikResponse = 'Simulated restoration';
                }

                success = true;
            } catch (error) {
                mikrotikResponse = `Error: ${error instanceof Error ? error.message : String(error)}`;
                success = false;
            }

            // Log isolation action
            const logQuery = `
                INSERT INTO isolation_logs (
                    customer_id, action, reason, performed_by, 
                    mikrotik_username, mikrotik_response
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            await connection.execute(logQuery, [
                isolationData.customer_id,
                isolationData.action,
                isolationData.reason,
                isolationData.performed_by || 'system',
                mikrotikUsername,
                mikrotikResponse
            ]);

            // Update customer isolation status
            if (isolationData.action === 'isolate') {
                await connection.execute(
                    'UPDATE customers SET is_isolated = TRUE WHERE id = ?',
                    [isolationData.customer_id]
                );
            } else {
                await connection.execute(
                    'UPDATE customers SET is_isolated = FALSE WHERE id = ?',
                    [isolationData.customer_id]
                );
            }

            await connection.commit();

            // Send notification to customer using template system
            try {
                if (customer.phone) {
                    if (isolationData.action === 'isolate') {
                        // Get invoice details for blocked notification
                        const [invoiceRows] = await connection.query<RowDataPacket[]>(
                            `SELECT invoice_number, total_amount, due_date, period 
                             FROM invoices 
                             WHERE customer_id = ? AND status != 'paid' 
                             ORDER BY due_date DESC LIMIT 2`,
                            [isolationData.customer_id]
                        );

                        let details = `Kode Pelanggan: ${customer.customer_code}`;
                        if (invoiceRows.length > 0) {
                            details += `\n⚠️ LAYANAN DIBLOKIR SEMENTARA\n`;
                            details += `Terdeteksi tunggakan ${invoiceRows.length} tagihan belum lunas.\n`;
                            details += `Total Tagihan Terakhir: Rp ${parseFloat(invoiceRows[0].total_amount).toLocaleString('id-ID')}\n`;
                            details += `\n⛔ Admin tidak dapat membuka blokir manual.\n`;
                            details += `✅ CARA BUKA BLOKIR:\n`;
                            details += `1. Transfer total tagihan ke rekening terdaftar.\n`;
                            details += `2. Kirim BUKTI TRANSFER via WhatsApp ini.\n`;
                            details += `3. Sistem AI akan memverifikasi dan membuka blokir otomatis.\n`;
                        }

                        await UnifiedNotificationService.queueNotification({
                            customer_id: isolationData.customer_id,
                            notification_type: 'service_blocked',
                            channels: ['whatsapp'],
                            variables: {
                                customer_name: customer.name || 'Pelanggan',
                                reason: isolationData.reason,
                                details: details
                            },
                            priority: 'high'
                        });

                        console.log(`[IsolationService] ✅ Block notification queued for customer ${customer.name}`);
                    } else {
                        // Restore notification
                        const [invoiceRows] = await connection.query<RowDataPacket[]>(
                            `SELECT invoice_number, total_amount, payment_date 
                             FROM invoices 
                             WHERE customer_id = ? AND status = 'paid' 
                             ORDER BY payment_date DESC LIMIT 1`,
                            [isolationData.customer_id]
                        );

                        let details = `Kode Pelanggan: ${customer.customer_code}`;
                        if (invoiceRows.length > 0) {
                            const invoice = invoiceRows[0];
                            details += `\n✅ Pembayaran diterima & Terverifikasi AI.\nLayanan internet Anda telah AKTIF kembali.`;
                        } else {
                            details += `\n✅ Layanan telah diaktifkan kembali`;
                        }

                        await UnifiedNotificationService.queueNotification({
                            customer_id: isolationData.customer_id,
                            notification_type: 'service_unblocked',
                            channels: ['whatsapp'],
                            variables: {
                                customer_name: customer.name || 'Pelanggan',
                                details: details
                            },
                            priority: 'normal'
                        });

                        console.log(`[IsolationService] ✅ Unblock notification queued for customer ${customer.name}`);
                    }
                }
            } catch (notifError) {
                console.error('[IsolationService] Failed to send notification (non-critical):', notifError);
            }

            return success;

        } catch (error) {
            await connection.rollback();
            console.error('Error in isolation service:', error);
            if (error instanceof Error && error.message.includes('BLOCKED')) {
                throw error;
            }
            return false;
        } finally {
            connection.release();
        }
    }

    /**
     * Send isolation warning 3 days before isolation
     */
    static async sendIsolationWarnings(daysBefore: number = 3): Promise<{ warned: number, failed: number }> {
        const connection = await databasePool.getConnection();
        let warned = 0;
        let failed = 0;

        try {
            // Get customers with unpaid invoices that will be isolated in X days
            const warningDate = new Date();
            warningDate.setDate(warningDate.getDate() + daysBefore);

            const query = `
                SELECT DISTINCT 
                    c.id, 
                    c.name, 
                    c.phone, 
                    c.customer_code,
                    i.id as invoice_id,
                    i.invoice_number,
                    i.total_amount,
                    i.remaining_amount,
                    i.due_date
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE i.status IN ('sent', 'partial', 'overdue')
                AND i.remaining_amount > 0
                AND c.is_isolated = FALSE
                AND c.status = 'active'
                AND DATE(i.due_date) = DATE(?)
                AND NOT EXISTS (
                    SELECT 1 FROM notification_queue nq
                    WHERE nq.customer_id = c.id
                    AND nq.notification_type = 'isolation_warning'
                    AND DATE(nq.created_at) = CURDATE()
                )
            `;

            const [customers] = await connection.query<RowDataPacket[]>(query, [warningDate.toISOString().split('T')[0]]);

            console.log(`[IsolationService] Found ${customers.length} customers to warn about isolation in ${daysBefore} days`);

            for (const customer of customers) {
                try {
                    if (!customer.phone) {
                        console.log(`[IsolationService] ⚠️ No phone number for customer ${customer.name}, skipping warning`);
                        continue;
                    }

                    const { UnifiedNotificationService } = await import('../notification/UnifiedNotificationService');

                    // Calculate days remaining
                    const dueDate = new Date(customer.due_date);
                    const today = new Date();
                    const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                    console.log(`[IsolationService] 📱 Sending isolation warning to customer ${customer.name} (${daysRemaining} days remaining)...`);

                    const notificationIds = await UnifiedNotificationService.queueNotification({
                        customer_id: customer.id,
                        invoice_id: customer.invoice_id,
                        notification_type: 'isolation_warning',
                        channels: ['whatsapp'],
                        variables: {
                            customer_name: customer.name || 'Pelanggan',
                            invoice_number: customer.invoice_number || '',
                            total_amount: parseFloat(customer.total_amount || 0).toLocaleString('id-ID'),
                            remaining_amount: parseFloat(customer.remaining_amount || 0).toLocaleString('id-ID'),
                            due_date: customer.due_date ? new Date(customer.due_date).toLocaleDateString('id-ID') : '-',
                            days_remaining: daysRemaining.toString()
                        },
                        priority: 'high'
                    });

                    console.log(`[IsolationService] ✅ Isolation warning queued (IDs: ${notificationIds.join(', ')})`);

                    // Process queue immediately
                    try {
                        const result = await UnifiedNotificationService.sendPendingNotifications(10);
                        console.log(`[IsolationService] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed`);
                    } catch (queueError: any) {
                        console.warn(`[IsolationService] ⚠️ Queue processing error (non-critical):`, queueError.message);
                    }

                    warned++;
                } catch (error: any) {
                    console.error(`[IsolationService] Failed to send warning to customer ${customer.id}:`, error.message);
                    failed++;
                }
            }

        } catch (error) {
            console.error('[IsolationService] Error sending isolation warnings:', error);
            throw error;
        } finally {
            connection.release();
        }

        return { warned, failed };
    }

    /**
     * Send pre-block warnings to customers with unpaid invoices
     * Called from 25th to end of month, warning about blocking on the 1st
     */
    static async sendPreBlockWarnings(): Promise<{ warned: number, failed: number }> {
        const connection = await databasePool.getConnection();
        let warned = 0;
        let failed = 0;

        try {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // Get current month period (YYYY-MM)
            const currentPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

            // Calculate blocking date (1st of next month)
            const nextMonth = new Date(currentYear, currentMonth + 1, 1);
            const blockingDate = nextMonth.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            // Get customers with unpaid invoices for current month
            const query = `
                SELECT DISTINCT 
                    c.id, 
                    c.name, 
                    c.phone, 
                    c.customer_code,
                    i.id as invoice_id,
                    i.invoice_number,
                    i.total_amount,
                    i.remaining_amount,
                    i.due_date
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE i.period = ?
                AND i.status IN ('sent', 'partial', 'overdue', 'draft')
                AND i.remaining_amount > 0
                AND c.is_isolated = FALSE
                AND c.status = 'active'
                AND c.phone IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM notification_queue nq
                    WHERE nq.customer_id = c.id
                    AND nq.notification_type = 'pre_block_warning'
                    AND DATE(nq.created_at) = CURDATE()
                )
            `;

            const [customers] = await connection.query<RowDataPacket[]>(query, [currentPeriod]);

            console.log(`[Pre-Block Warning] Found ${customers.length} customers with unpaid invoices for period ${currentPeriod}`);

            for (const customer of customers) {
                try {
                    if (!customer.phone) {
                        console.log(`[Pre-Block Warning] ⚠️ No phone number for customer ${customer.name}, skipping`);
                        continue;
                    }

                    const { UnifiedNotificationService } = await import('../notification/UnifiedNotificationService');

                    // Calculate days until blocking
                    const daysUntilBlock = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                    console.log(`[Pre-Block Warning] 📱 Sending warning to ${customer.name} - ${daysUntilBlock} days until block...`);

                    const notificationIds = await UnifiedNotificationService.queueNotification({
                        customer_id: customer.id,
                        invoice_id: customer.invoice_id,
                        notification_type: 'pre_block_warning',
                        channels: ['whatsapp'],
                        variables: {
                            customer_name: customer.name || 'Pelanggan',
                            customer_code: customer.customer_code || '',
                            invoice_number: customer.invoice_number || '',
                            total_amount: parseFloat(customer.total_amount || 0).toLocaleString('id-ID'),
                            remaining_amount: parseFloat(customer.remaining_amount || 0).toLocaleString('id-ID'),
                            due_date: customer.due_date ? new Date(customer.due_date).toLocaleDateString('id-ID') : '-',
                            blocking_date: blockingDate,
                            days_until_block: daysUntilBlock.toString()
                        },
                        priority: 'high'
                    });

                    console.log(`[Pre-Block Warning] ✅ Warning queued for ${customer.name} (IDs: ${notificationIds.join(', ')})`);

                    // Process queue immediately
                    try {
                        const result = await UnifiedNotificationService.sendPendingNotifications(10);
                        console.log(`[Pre-Block Warning] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed`);
                    } catch (queueError: any) {
                        console.warn(`[Pre-Block Warning] ⚠️ Queue processing error (non-critical):`, queueError.message);
                    }

                    warned++;
                } catch (error: any) {
                    console.error(`[Pre-Block Warning] Failed to send warning to customer ${customer.id}:`, error.message);
                    failed++;
                }
            }

        } catch (error) {
            console.error('[Pre-Block Warning] Error sending pre-block warnings:', error);
            throw error;
        } finally {
            connection.release();
        }

        return { warned, failed };
    }

    /**
     * Auto isolir pelanggan dengan 2x tagihan belum lunas
     */
    static async autoIsolateOverdueCustomers(): Promise<{ isolated: number, failed: number }> {
        // Get customers with >= 2 overdue/unpaid invoices
        const query = `
            SELECT c.id, c.name, c.phone, c.email, COUNT(i.id) as unpaid_count
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.status != 'paid' 
            AND i.due_date < CURDATE()
            AND c.is_isolated = FALSE
            AND c.is_deferred = FALSE
            GROUP BY c.id
            HAVING unpaid_count >= 2
        `;

        const [result] = await databasePool.execute(query);
        let isolated = 0;
        let failed = 0;
        const customers = result as any[];

        console.log(`[Auto Isolation] Found ${customers.length} customers with 2+ unpaid invoices`);

        for (const customer of customers) {
            try {
                const isolationData: IsolationData = {
                    customer_id: customer.id || 0,
                    action: 'isolate',
                    reason: `Auto Lock system: Terdeteksi ${customer.unpaid_count} tagihan belum lunas (Min 2)`
                };

                const success = await this.isolateCustomer(isolationData);
                if (success) {
                    isolated++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`Failed to isolate customer ${customer.id || 0}:`, error);
                failed++;
            }
        }

        return { isolated, failed };
    }

    /**
     * Auto isolir pelanggan dengan tagihan bulan sebelumnya yang belum lunas
     * Dipanggil setiap hari untuk isolir berdasarkan tanggal yang ditentukan
     */
    static async autoIsolatePreviousMonthUnpaid(): Promise<{ isolated: number, failed: number }> {
        // Get previous month period (YYYY-MM)
        const now = new Date();
        const currentDate = now.getDate();
        const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousPeriod = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

        // Get scheduler settings for isolation date
        let targetIsolateDate = 1;
        try {
            // Fetch config from scheduler_settings. We check invoice_generation as that's where isolir settings are stored
            const [rows] = await databasePool.query<RowDataPacket[]>(
                "SELECT config FROM scheduler_settings WHERE task_name = 'invoice_generation'"
            );

            if (rows.length > 0) {
                const row = rows[0];
                // Parse config JSON
                if (row.config) {
                    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
                    if (config.isolir_date) {
                        targetIsolateDate = config.isolir_date;
                    }
                }
            }
        } catch (err) {
            console.warn("Could not fetch isolation settings, defaulting to date 1", err);
        }

        // Only run if today is the target isolation date
        if (currentDate !== targetIsolateDate) {
            return { isolated: 0, failed: 0 };
        }

        // Get customers with unpaid invoices from previous month
        const query = `
            SELECT DISTINCT 
                c.id, 
                c.name, 
                c.phone, 
                c.email,
                i.due_date
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.period = ?
            AND i.status != 'paid'
            AND c.is_isolated = FALSE
            AND c.is_deferred = FALSE
            AND c.status = 'active'
        `;

        const [result] = await databasePool.execute(query, [previousPeriod]);
        let isolated = 0;
        let failed = 0;

        console.log(`[Auto Isolation] Checking unpaid invoices for period ${previousPeriod}`);
        console.log(`[Auto Isolation] Found ${(result as any[]).length} customers with unpaid invoices`);

        for (const customer of (result as any)) {
            try {
                const isolationData: IsolationData = {
                    customer_id: customer.id || 0,
                    action: 'isolate',
                    reason: `Auto isolation: Unpaid invoice for period ${previousPeriod}`
                };

                const success = await this.isolateCustomer(isolationData);
                if (success) {
                    isolated++;
                    console.log(`[Auto Isolation] ✓ Isolated customer: ${customer.name} (ID: ${customer.id})`);
                } else {
                    failed++;
                    console.log(`[Auto Isolation] ✗ Failed to isolate customer: ${customer.name} (ID: ${customer.id})`);
                }
            } catch (error) {
                console.error(`[Auto Isolation] ✗ Error isolating customer ${customer.id || 0}:`, error);
                failed++;
            }
        }

        console.log(`[Auto Isolation] Summary: ${isolated} isolated, ${failed} failed`);
        return { isolated, failed };
    }

    /**
     * Auto restore pelanggan yang sudah lunas
     */
    static async autoRestorePaidCustomers(): Promise<{ restored: number, failed: number }> {
        // Get isolated customers with paid invoices
        const query = `
            SELECT DISTINCT c.id, c.name, c.phone, c.email
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.status = 'paid'
            AND i.period = DATE_FORMAT(CURRENT_DATE, '%Y-%m')
            AND c.is_isolated = TRUE
        `;

        const [result] = await databasePool.execute(query);
        let restored = 0;
        let failed = 0;

        for (const customer of (result as any)) {
            try {
                const isolationData: IsolationData = {
                    customer_id: customer.id || 0,
                    action: 'restore',
                    reason: 'Auto restore due to payment completion'
                };

                const success = await this.isolateCustomer(isolationData);
                if (success) {
                    restored++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`Failed to restore customer ${customer.id || 0}:`, error);
                failed++;
            }
        }

        return { restored, failed };
    }

    /**
     * Get isolation history
     */
    static async getIsolationHistory(customerId?: number, limit: number = 50) {
        let query = `
            SELECT il.*, c.name as customer_name, c.phone
            FROM isolation_logs il
            JOIN customers c ON il.customer_id = c.id
        `;

        const params: any[] = [];

        if (customerId) {
            query += ' WHERE il.customer_id = ?';
            params.push(customerId);
        }

        query += ' ORDER BY il.created_at DESC LIMIT ?';
        params.push(limit);

        const [result] = await databasePool.execute(query, params);
        return result;
    }

    /**
     * Get isolated customers
     */
    static async getIsolatedCustomers() {
        const query = `
            SELECT c.*, il.reason, il.created_at as isolated_at
            FROM customers c
            JOIN isolation_logs il ON c.id = il.customer_id
            WHERE c.is_isolated = TRUE
            AND il.action = 'isolate'
            ORDER BY il.created_at DESC
        `;

        const [result] = await databasePool.execute(query);
        return result;
    }

    /**
     * Bulk isolate customers by ODC
     */
    static async bulkIsolateByOdc(odcId: number, reason: string): Promise<{ isolated: number, failed: number }> {
        const query = `
            SELECT id FROM customers 
            WHERE odc_id = ? AND is_isolated = FALSE AND status = 'active'
        `;

        const [result] = await databasePool.execute(query, [odcId]);
        let isolated = 0;
        let failed = 0;

        for (const customer of (result as any)) {
            try {
                const isolationData: IsolationData = {
                    customer_id: customer.id || 0,
                    action: 'isolate',
                    reason: reason
                };

                const success = await this.isolateCustomer(isolationData);
                if (success) {
                    isolated++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`Failed to isolate customer ${customer.id || 0}:`, error);
                failed++;
            }
        }

        return { isolated, failed };
    }
    /**
     * Auto delete (soft delete) customers blocked > 7 days
     */
    static async autoDeleteBlockedCustomers(): Promise<{ deleted: number, failed: number }> {
        const connection = await databasePool.getConnection();
        let deleted = 0;
        let failed = 0;

        try {
            // Find customers isolated > 7 days ago
            // We use isolation_logs to find the last isolation date
            // OR checks customers table if we had an 'isolated_at' column.
            // Using isolation_logs is safer if we don't trust a single column.
            // However, for performance, let's assume we can query customers who are isolated.

            // Note: In `isolateCustomer` we don't update `isolated_at` on the customer table (only `is_isolated`).
            // We should use `isolation_logs` to find when they were isolated.

            const query = `
                SELECT c.id, c.name, MAX(il.created_at) as last_isolation_date
                FROM customers c
                JOIN isolation_logs il ON c.id = il.customer_id
                WHERE c.is_isolated = 1
                AND c.status != 'deleted'
                AND il.action = 'isolate'
                GROUP BY c.id
                HAVING last_isolation_date < DATE_SUB(NOW(), INTERVAL 7 DAY)
            `;

            const [customers] = await connection.query(query);

            console.log(`[AutoDelete] Found ${(customers as any[]).length} customers blocked > 7 days`);

            for (const customer of (customers as any[])) {
                try {
                    await connection.beginTransaction();

                    // Soft delete customer
                    await connection.query('UPDATE customers SET status = "deleted", deleted_at = NOW() WHERE id = ?', [customer.id]);

                    // Terminate subscription
                    await connection.query('UPDATE subscriptions SET status = "terminated", end_date = NOW() WHERE customer_id = ? AND status = "active"', [customer.id]);

                    // Log action
                    await connection.query(`
                        INSERT INTO customer_logs (customer_id, action, description, created_by, created_at)
                        VALUES (?, 'auto_delete', 'Auto deleted after 7 days of isolation', 0, NOW())
                    `, [customer.id]);

                    await connection.commit();

                    // Send notification (Fire and forget)
                    try {
                        const { UnifiedNotificationService } = await import('../notification/UnifiedNotificationService');
                        await UnifiedNotificationService.queueNotification({
                            customer_id: customer.id,
                            notification_type: 'customer_deleted',
                            channels: ['whatsapp'],
                            variables: {
                                customer_name: customer.name,
                                reason: 'Tidak ada pembayaran setelah 7 hari isolir.'
                            },
                            priority: 'normal'
                        });
                    } catch (e) {
                        console.error('Failed to send delete notification:', e);
                    }

                    deleted++;
                    console.log(`[AutoDelete] Soft deleted customer ${customer.name} (${customer.id})`);

                } catch (err) {
                    await connection.rollback();
                    console.error(`[AutoDelete] Failed to delete customer ${customer.id}:`, err);
                    failed++;
                }
            }

            return { deleted, failed };

        } catch (error) {
            console.error('[AutoDelete] Error in auto delete process:', error);
            throw error;
        } finally {
            connection.release();
        }
    }
}
