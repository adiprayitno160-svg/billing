import { databasePool } from '../../db/pool';

export class BillingDashboardService {
    
    /**
     * Get comprehensive billing statistics
     */
    static async getBillingStatistics() {
        try {
            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM customers WHERE is_isolated = FALSE) as active_customers,
                    (SELECT COUNT(*) FROM customers WHERE is_isolated = TRUE) as isolated_customers,
                    (SELECT COUNT(*) FROM invoices WHERE status IN ('sent', 'partial')) as pending_bills,
                    (SELECT COUNT(*) FROM invoices WHERE status = 'overdue') as overdue_bills,
                    (SELECT COUNT(*) FROM invoices WHERE status = 'paid' AND period = DATE_FORMAT(CURRENT_DATE, '%Y-%m')) as paid_bills,
                    (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'paid' AND period = DATE_FORMAT(CURRENT_DATE, '%Y-%m')) as monthly_revenue,
                    (SELECT COUNT(*) FROM invoices WHERE status = 'paid' AND period = DATE_FORMAT(CURRENT_DATE, '%Y-%m')) as successful_payments,
                    (SELECT COUNT(*) FROM customers) as total_customers,
                    (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'overdue') as overdue_amount,
                    (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status IN ('sent', 'partial')) as pending_amount
            `;
            
            const [result] = await databasePool.execute(query);
            return (result as any)[0];
        } catch (error) {
            console.error('Error getting billing statistics:', error);
            throw error;
        }
    }

    /**
     * Get billing trends for charts
     */
    static async getBillingTrends(days: number = 30) {
        try {
            const query = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total_bills,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_bills,
                    SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_bills,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as revenue
                FROM invoices 
                WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `;
            
            const [result] = await databasePool.execute(query, [days]);
            return result;
        } catch (error) {
            console.error('Error getting billing trends:', error);
            throw error;
        }
    }

    /**
     * Get customer payment behavior
     */
    static async getCustomerPaymentBehavior() {
        try {
            const query = `
                SELECT 
                    c.id,
                    c.name,
                    c.phone,
                    c.email,
                    COUNT(i.id) as total_invoices,
                    SUM(CASE WHEN i.status = 'paid' THEN 1 ELSE 0 END) as paid_invoices,
                    SUM(CASE WHEN i.status = 'overdue' THEN 1 ELSE 0 END) as overdue_invoices,
                    AVG(CASE WHEN i.status = 'paid' THEN DATEDIFF(i.paid_at, i.due_date) ELSE NULL END) as avg_payment_delay,
                    c.is_isolated,
                    MAX(i.created_at) as last_invoice_date
                FROM customers c
                LEFT JOIN invoices i ON c.id = i.customer_id
                GROUP BY c.id, c.name, c.phone, c.email, c.is_isolated
                ORDER BY overdue_invoices DESC, avg_payment_delay DESC
                LIMIT 50
            `;
            
            const [result] = await databasePool.execute(query);
            return result;
        } catch (error) {
            console.error('Error getting customer payment behavior:', error);
            throw error;
        }
    }

    /**
     * Get overdue customers for quick action
     */
    static async getOverdueCustomers(limit: number = 20) {
        try {
            const query = `
                SELECT 
                    c.id,
                    c.name,
                    c.phone,
                    c.email,
                    i.id as invoice_id,
                    i.amount,
                    i.due_date,
                    DATEDIFF(CURRENT_DATE, i.due_date) as days_overdue,
                    i.status
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE i.status = 'overdue'
                AND c.is_isolated = FALSE
                ORDER BY days_overdue DESC
                LIMIT ?
            `;
            
            const [result] = await databasePool.execute(query, [limit]);
            return result;
        } catch (error) {
            console.error('Error getting overdue customers:', error);
            throw error;
        }
    }

    /**
     * Get recent billing activities
     */
    static async getRecentBillingActivities(limit: number = 20) {
        try {
            const query = `
                SELECT 
                    'isolation' as activity_type,
                    CONCAT('Customer ', c.name, ' isolated') as description,
                    il.created_at as timestamp,
                    'warning' as status,
                    il.reason
                FROM isolation_logs il
                JOIN customers c ON il.customer_id = c.id
                WHERE il.action = 'isolate'
                AND il.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                
                UNION ALL
                
                SELECT 
                    'restore' as activity_type,
                    CONCAT('Customer ', c.name, ' restored') as description,
                    il.created_at as timestamp,
                    'success' as status,
                    il.reason
                FROM isolation_logs il
                JOIN customers c ON il.customer_id = c.id
                WHERE il.action = 'restore'
                AND il.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                
                UNION ALL
                
                SELECT 
                    'payment' as activity_type,
                    CONCAT('Payment received from ', c.name, ' - Rp ', FORMAT(p.amount, 0)) as description,
                    p.created_at as timestamp,
                    'success' as status,
                    p.notes as reason
                FROM payments p
                JOIN customers c ON p.customer_id = c.id
                WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                
                UNION ALL
                
                SELECT 
                    'invoice' as activity_type,
                    CONCAT('Invoice created for ', c.name, ' - Rp ', FORMAT(i.amount, 0)) as description,
                    i.created_at as timestamp,
                    'info' as status,
                    i.description as reason
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                
                ORDER BY timestamp DESC
                LIMIT ?
            `;
            
            const [result] = await databasePool.execute(query, [limit]);
            return result;
        } catch (error) {
            console.error('Error getting recent billing activities:', error);
            throw error;
        }
    }

    /**
     * Get system health metrics
     */
    static async getSystemHealthMetrics() {
        try {
            // Database health
            const dbHealth = await databasePool.query('SELECT 1 as health');
            const dbConnected = Array.isArray(dbHealth[0]) && dbHealth[0].length > 0;
            
            // Get notification failures
            const notificationQuery = `
                SELECT COUNT(*) as count 
                FROM notification_logs 
                WHERE status = 'failed' 
                AND sent_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            `;
            const notificationResult = await databasePool.query(notificationQuery);
            const notificationFailures = parseInt((notificationResult[0] as any)[0]?.count || '0');
            
            // Get auto actions status
            const autoActionsQuery = `
                SELECT 
                    (SELECT setting_value FROM system_settings WHERE setting_key = 'auto_isolate_enabled' LIMIT 1) as auto_isolate,
                    (SELECT setting_value FROM system_settings WHERE setting_key = 'auto_restore_enabled' LIMIT 1) as auto_restore,
                    (SELECT setting_value FROM system_settings WHERE setting_key = 'auto_notifications_enabled' LIMIT 1) as auto_notifications
            `;
            const [autoActionsResult] = await databasePool.execute(autoActionsQuery);
            const autoActions = (autoActionsResult as any)[0];
            
            return {
                database: {
                    connected: dbConnected,
                    status: dbConnected ? 'healthy' : 'unhealthy'
                },
                notifications: {
                    failures_last_7_days: notificationFailures,
                    status: notificationFailures < 10 ? 'healthy' : 'warning'
                },
                auto_actions: {
                    isolate: autoActions?.auto_isolate === 'true',
                    restore: autoActions?.auto_restore === 'true',
                    notifications: autoActions?.auto_notifications === 'true'
                },
                overall_status: dbConnected && notificationFailures < 10 ? 'healthy' : 'warning'
            };
        } catch (error) {
            console.error('Error getting system health metrics:', error);
            return {
                database: { connected: false, status: 'unhealthy' },
                notifications: { failures_last_7_days: 0, status: 'unknown' },
                auto_actions: { isolate: false, restore: false, notifications: false },
                overall_status: 'unhealthy'
            };
        }
    }

    /**
     * Get SLA statistics
     */
    static async getSlaStatistics() {
        try {
            const slaStats = { total: 0, compliant: 0, nonCompliant: 0 };
            return slaStats;
        } catch (error) {
            console.error('Error getting SLA statistics:', error);
            return {
                overall_sla: 0,
                sla_incidents: 0,
                sla_compliance: 0
            };
        }
    }

    /**
     * Search customers for quick actions
     */
    static async searchCustomers(searchTerm: string, limit: number = 20) {
        try {
            const query = `
                SELECT 
                    c.id,
                    c.name,
                    c.phone,
                    c.email,
                    c.is_isolated,
                    COUNT(i.id) as total_invoices,
                    SUM(CASE WHEN i.status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
                    MAX(i.due_date) as last_due_date
                FROM customers c
                LEFT JOIN invoices i ON c.id = i.customer_id
                WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
                GROUP BY c.id, c.name, c.phone, c.email, c.is_isolated
                ORDER BY overdue_count DESC, c.name ASC
                LIMIT ?
            `;
            
            const searchPattern = `%${searchTerm}%`;
            const [result] = await databasePool.execute(query, [searchPattern, searchPattern, searchPattern, limit]);
            return result;
        } catch (error) {
            console.error('Error searching customers:', error);
            throw error;
        }
    }

    /**
     * Get dashboard summary for quick overview
     */
    static async getDashboardSummary() {
        try {
            const [
                billingStats,
                systemHealth,
                recentActivities,
                slaStats
            ] = await Promise.all([
                this.getBillingStatistics(),
                this.getSystemHealthMetrics(),
                this.getRecentBillingActivities(5),
                this.getSlaStatistics()
            ]);

            return {
                billing: billingStats,
                system: systemHealth,
                activities: recentActivities,
                sla: slaStats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting dashboard summary:', error);
            throw error;
        }
    }

    /**
     * Update auto billing settings
     */
    static async updateAutoBillingSettings(settings: {
        auto_isolate?: boolean;
        auto_restore?: boolean;
        auto_notifications?: boolean;
    }) {
        try {
            const updates = [];
            
            if (settings.auto_isolate !== undefined) {
                updates.push(`('auto_isolate_enabled', '${settings.auto_isolate}', NOW())`);
            }
            
            if (settings.auto_restore !== undefined) {
                updates.push(`('auto_restore_enabled', '${settings.auto_restore}', NOW())`);
            }
            
            if (settings.auto_notifications !== undefined) {
                updates.push(`('auto_notifications_enabled', '${settings.auto_notifications}', NOW())`);
            }
            
            if (updates.length > 0) {
                const query = `
                    INSERT INTO system_settings (setting_key, setting_value, updated_at) 
                    VALUES ${updates.join(', ')}
                    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
                `;
                
                await databasePool.execute(query);
            }
            
            return true;
        } catch (error) {
            console.error('Error updating auto billing settings:', error);
            throw error;
        }
    }
}
