import { databasePool } from '../../db/pool';

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
