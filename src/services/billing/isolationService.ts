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
                // Call MikroTik service to isolate user
                // This depends on your MikroTikService implementation
                // const { MikrotikService } = await import('../mikrotikService');
                // const mikrotikService = new (MikrotikService as any)();
                
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
                const [customerRows] = await connection.query<RowDataPacket[]>(
                    'SELECT name, phone, customer_code FROM customers WHERE id = ?',
                    [isolationData.customer_id]
                );
                
                if (customerRows.length > 0 && customerRows[0].phone) {
                    const customer = customerRows[0];
                    
                    if (isolationData.action === 'isolate') {
                        // Get invoice details for blocked notification
                        const [invoiceRows] = await connection.query<RowDataPacket[]>(
                            `SELECT invoice_number, total_amount, due_date, period 
                             FROM invoices 
                             WHERE customer_id = ? AND status != 'paid' 
                             ORDER BY due_date DESC LIMIT 1`,
                            [isolationData.customer_id]
                        );
                        
                        let details = `Kode Pelanggan: ${customer.customer_code}`;
                        if (invoiceRows.length > 0) {
                            const invoice = invoiceRows[0];
                            details += `\n📄 Invoice: ${invoice.invoice_number}\n💰 Jumlah: Rp ${parseFloat(invoice.total_amount).toLocaleString('id-ID')}\n📅 Jatuh Tempo: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('id-ID') : 'N/A'}`;
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
                            details += `\n✅ Pembayaran untuk invoice ${invoice.invoice_number} telah diterima`;
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
                // Non-critical, don't fail the isolation process
            }
            
            return success;
            
        } catch (error) {
            await connection.rollback();
            console.error('Error in isolation service:', error);
            return false;
        } finally {
            connection.release();
        }
    }

    /**
     * Send isolation warning 3 days before isolation
     */
    static async sendIsolationWarnings(daysBefore: number = 3): Promise<{warned: number, failed: number}> {
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
     * Auto isolir pelanggan dengan invoice overdue
     */
    static async autoIsolateOverdueCustomers(): Promise<{isolated: number, failed: number}> {
        // Get customers with overdue invoices
        const query = `
            SELECT DISTINCT c.id, c.name, c.phone, c.email
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.status = 'overdue'
            AND i.due_date < CURDATE()
            AND c.is_isolated = FALSE
        `;
        
        const [result] = await databasePool.execute(query);
        let isolated = 0;
        let failed = 0;
        
        for (const customer of (result as any)) {
            try {
                const isolationData: IsolationData = {
                    customer_id: customer.id || 0,
                    action: 'isolate',
                    reason: 'Auto isolation due to overdue invoice'
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
     * Dipanggil setiap hari untuk isolir berdasarkan custom deadline atau default (tanggal 1)
     */
    static async autoIsolatePreviousMonthUnpaid(): Promise<{isolated: number, failed: number}> {
        // Get previous month period (YYYY-MM)
        const now = new Date();
        const currentDate = now.getDate();
        const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousPeriod = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
        
        // Get customers with unpaid invoices from previous month, including custom deadline info
        const query = `
            SELECT DISTINCT 
                c.id, 
                c.name, 
                c.phone, 
                c.email,
                c.custom_payment_deadline,
                c.custom_isolate_days_after_deadline,
                i.due_date
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.period = ?
            AND i.status != 'paid'
            AND c.is_isolated = FALSE
            AND c.status = 'active'
        `;
        
        const [result] = await databasePool.execute(query, [previousPeriod]);
        let isolated = 0;
        let failed = 0;
        
        console.log(`[Auto Isolation] Checking unpaid invoices for period ${previousPeriod}`);
        console.log(`[Auto Isolation] Found ${(result as any[]).length} customers with unpaid invoices`);
        
        for (const customer of (result as any)) {
            try {
                let shouldIsolate = false;
                
                // Check if customer has custom deadline
                if (customer.custom_payment_deadline && customer.custom_payment_deadline >= 1 && customer.custom_payment_deadline <= 31) {
                    // For customers with custom deadline, isolate after X days from deadline
                    const customDeadline = customer.custom_payment_deadline;
                    const isolateDaysAfter = customer.custom_isolate_days_after_deadline || 1;
                    
                    // Calculate isolation date based on previous month's deadline
                    // For example: if deadline is 25, and we're checking for previous month's invoice
                    // Isolation should be on the 25th + isolateDaysAfter of current month
                    const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, customDeadline);
                    const isolationDate = new Date(previousMonthDate);
                    isolationDate.setDate(isolationDate.getDate() + isolateDaysAfter);
                    
                    // Check if today is the isolation date or later
                    const today = new Date(now.getFullYear(), now.getMonth(), currentDate);
                    if (today >= isolationDate) {
                        shouldIsolate = true;
                        console.log(`[Auto Isolation] Customer ${customer.name} (ID: ${customer.id}) - Custom deadline ${customDeadline}, isolation date: ${isolationDate.toISOString().split('T')[0]}, today: ${today.toISOString().split('T')[0]}`);
                    }
                } else {
                    // For customers without custom deadline, isolate on the 1st of the month
                    if (currentDate === 1) {
                        shouldIsolate = true;
                        console.log(`[Auto Isolation] Customer ${customer.name} (ID: ${customer.id}) - Default deadline, isolating on 1st`);
                    }
                }
                
                if (shouldIsolate) {
                    const isolationData: IsolationData = {
                        customer_id: customer.id || 0,
                        action: 'isolate',
                        reason: customer.custom_payment_deadline 
                            ? `Auto isolation: Unpaid invoice for period ${previousPeriod} (custom deadline ${customer.custom_payment_deadline})`
                            : `Auto isolation: Unpaid invoice for period ${previousPeriod}`
                    };
                    
                    const success = await this.isolateCustomer(isolationData);
                    if (success) {
                        isolated++;
                        console.log(`[Auto Isolation] ✓ Isolated customer: ${customer.name} (ID: ${customer.id})`);
                    } else {
                        failed++;
                        console.log(`[Auto Isolation] ✗ Failed to isolate customer: ${customer.name} (ID: ${customer.id})`);
                    }
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
    static async autoRestorePaidCustomers(): Promise<{restored: number, failed: number}> {
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
    static async bulkIsolateByOdc(odcId: number, reason: string): Promise<{isolated: number, failed: number}> {
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
}
