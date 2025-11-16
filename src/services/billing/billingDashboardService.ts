import { databasePool } from '../../db/pool';
import { BillingLogService } from './BillingLogService';
import { RowDataPacket } from 'mysql2';

// Type definitions for query results
interface BillingStatistics extends RowDataPacket {
    active_customers: number;
    isolated_customers: number;
    pending_bills: number;
    overdue_bills: number;
    paid_bills: number;
    monthly_revenue: number;
    successful_payments: number;
    total_customers: number;
    overdue_amount: number;
    pending_amount: number;
}

interface BillingTrend extends RowDataPacket {
    date: Date;
    total_bills: number;
    paid_bills: number;
    overdue_bills: number;
    revenue: number;
}

interface CustomerPaymentBehavior extends RowDataPacket {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    total_invoices: number;
    paid_invoices: number;
    overdue_invoices: number;
    avg_payment_delay: number | null;
    is_isolated: boolean;
    last_invoice_date: Date | null;
}

interface OverdueCustomer extends RowDataPacket {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    invoice_id: number;
    amount: number;
    due_date: Date;
    days_overdue: number;
    status: string;
}

interface BillingActivity extends RowDataPacket {
    activity_type: 'isolation' | 'restore' | 'payment' | 'invoice';
    description: string;
    timestamp: Date;
    status: 'warning' | 'success' | 'info';
    reason: string | null;
}

interface NotificationCount extends RowDataPacket {
    count: string;
}

interface AutoActionsSettings extends RowDataPacket {
    auto_isolate: string | null;
    auto_restore: string | null;
    auto_notifications: string | null;
}

interface CustomerSearchResult extends RowDataPacket {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    is_isolated: boolean;
    total_invoices: number;
    overdue_count: number;
    last_due_date: Date | null;
}

interface SystemHealthMetrics {
    database: {
        connected: boolean;
        status: 'healthy' | 'unhealthy';
    };
    notifications: {
        failures_last_7_days: number;
        status: 'healthy' | 'warning' | 'unknown';
    };
    auto_actions: {
        isolate: boolean;
        restore: boolean;
        notifications: boolean;
    };
    overall_status: 'healthy' | 'warning' | 'unhealthy';
}

interface SlaStatistics {
    overall_sla?: number;
    sla_incidents?: number;
    sla_compliance?: number;
    total?: number;
    compliant?: number;
    nonCompliant?: number;
}

interface DashboardSummary {
    billing: BillingStatistics;
    system: SystemHealthMetrics;
    activities: BillingActivity[];
    sla: SlaStatistics;
    timestamp: string;
}

export class BillingDashboardService {
    
    /**
     * Get comprehensive billing statistics
     */
    static async getBillingStatistics(): Promise<BillingStatistics> {
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
            
            const [result] = await databasePool.execute<BillingStatistics[]>(query);
            const stats = result[0];
            
            if (!stats) {
                throw new Error('Failed to retrieve billing statistics');
            }
            
            // Log successful retrieval
            await BillingLogService.info('billing', 'BillingDashboard', 'Billing statistics retrieved', {
                stats
            });
            
            return stats;
        } catch (error) {
            await BillingLogService.error('billing', 'BillingDashboard', 'Error getting billing statistics', error as Error);
            throw error;
        }
    }

    /**
     * Get billing trends for charts
     */
    static async getBillingTrends(days: number = 30): Promise<BillingTrend[]> {
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
            
            const [result] = await databasePool.execute<BillingTrend[]>(query, [days]);
            await BillingLogService.info('billing', 'BillingDashboard', `Billing trends retrieved for ${days} days`);
            return result;
        } catch (error) {
            await BillingLogService.error('billing', 'BillingDashboard', 'Error getting billing trends', error as Error);
            throw error;
        }
    }

    /**
     * Get customer payment behavior
     */
    static async getCustomerPaymentBehavior(): Promise<CustomerPaymentBehavior[]> {
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
            
            const [result] = await databasePool.execute<CustomerPaymentBehavior[]>(query);
            await BillingLogService.info('billing', 'BillingDashboard', 'Customer payment behavior retrieved');
            return result;
        } catch (error) {
            await BillingLogService.error('billing', 'BillingDashboard', 'Error getting customer payment behavior', error as Error);
            throw error;
        }
    }

    /**
     * Get overdue customers for quick action
     */
    static async getOverdueCustomers(limit: number = 20): Promise<OverdueCustomer[]> {
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
            
            const [result] = await databasePool.execute<OverdueCustomer[]>(query, [limit]);
            const overdueCount = result.length;
            await BillingLogService.info('billing', 'BillingDashboard', `Retrieved ${overdueCount} overdue customers`, {
                limit,
                count: overdueCount
            });
            return result;
        } catch (error) {
            await BillingLogService.error('billing', 'BillingDashboard', 'Error getting overdue customers', error as Error);
            throw error;
        }
    }

    /**
     * Get recent billing activities
     */
    static async getRecentBillingActivities(limit: number = 20): Promise<BillingActivity[]> {
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
            
            const [result] = await databasePool.execute<BillingActivity[]>(query, [limit]);
            await BillingLogService.info('billing', 'BillingDashboard', 'Recent billing activities retrieved');
            return result;
        } catch (error) {
            await BillingLogService.error('billing', 'BillingDashboard', 'Error getting recent billing activities', error as Error);
            throw error;
        }
    }

    /**
     * Get system health metrics
     */
    static async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
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
            const [notificationResult] = await databasePool.execute<NotificationCount[]>(notificationQuery);
            const notificationFailures = parseInt(notificationResult[0]?.count || '0', 10);
            
            // Get auto actions status
            const autoActionsQuery = `
                SELECT 
                    (SELECT setting_value FROM system_settings WHERE setting_key = 'auto_isolate_enabled' LIMIT 1) as auto_isolate,
                    (SELECT setting_value FROM system_settings WHERE setting_key = 'auto_restore_enabled' LIMIT 1) as auto_restore,
                    (SELECT setting_value FROM system_settings WHERE setting_key = 'auto_notifications_enabled' LIMIT 1) as auto_notifications
            `;
            const [autoActionsResult] = await databasePool.execute<AutoActionsSettings[]>(autoActionsQuery);
            const autoActions = autoActionsResult[0];
            
            const health: SystemHealthMetrics = {
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
            
            if (health.overall_status !== 'healthy') {
                await BillingLogService.warning('system', 'BillingDashboard', 'System health check shows non-healthy status', health);
            } else {
                await BillingLogService.info('system', 'BillingDashboard', 'System health check passed');
            }
            
            return health;
        } catch (error) {
            await BillingLogService.error('system', 'BillingDashboard', 'Error getting system health metrics', error as Error);
            const errorHealth: SystemHealthMetrics = {
                database: { connected: false, status: 'unhealthy' },
                notifications: { failures_last_7_days: 0, status: 'unknown' },
                auto_actions: { isolate: false, restore: false, notifications: false },
                overall_status: 'unhealthy'
            };
            return errorHealth;
        }
    }

    /**
     * Get SLA statistics
     */
    static async getSlaStatistics(): Promise<SlaStatistics> {
        try {
            const slaStats = { total: 0, compliant: 0, nonCompliant: 0 };
            await BillingLogService.info('billing', 'BillingDashboard', 'SLA statistics retrieved');
            return slaStats;
        } catch (error) {
            await BillingLogService.error('billing', 'BillingDashboard', 'Error getting SLA statistics', error as Error);
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
    static async searchCustomers(searchTerm: string, limit: number = 20): Promise<CustomerSearchResult[]> {
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
            const [result] = await databasePool.execute<CustomerSearchResult[]>(query, [searchPattern, searchPattern, searchPattern, limit]);
            await BillingLogService.info('billing', 'BillingDashboard', `Customer search performed: "${searchTerm}"`, {
                searchTerm,
                resultsCount: result.length
            });
            return result;
        } catch (error) {
            await BillingLogService.error('billing', 'BillingDashboard', 'Error searching customers', error as Error);
            throw error;
        }
    }

    /**
     * Get dashboard summary for quick overview
     */
    static async getDashboardSummary(): Promise<DashboardSummary> {
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

            const summary = {
                billing: billingStats,
                system: systemHealth,
                activities: recentActivities,
                sla: slaStats,
                timestamp: new Date().toISOString()
            };
            
            await BillingLogService.info('billing', 'BillingDashboard', 'Dashboard summary retrieved');
            return summary;
        } catch (error) {
            await BillingLogService.error('billing', 'BillingDashboard', 'Error getting dashboard summary', error as Error);
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
    }): Promise<boolean> {
        try {
            // Use parameterized queries to prevent SQL injection
            const settingsToUpdate: string[] = [];
            const values: string[] = [];
            
            if (settings.auto_isolate !== undefined) {
                settingsToUpdate.push('auto_isolate_enabled');
                values.push(settings.auto_isolate ? 'true' : 'false');
            }
            
            if (settings.auto_restore !== undefined) {
                settingsToUpdate.push('auto_restore_enabled');
                values.push(settings.auto_restore ? 'true' : 'false');
            }
            
            if (settings.auto_notifications !== undefined) {
                settingsToUpdate.push('auto_notifications_enabled');
                values.push(settings.auto_notifications ? 'true' : 'false');
            }
            
            // Update each setting individually using parameterized query
            for (let i = 0; i < settingsToUpdate.length; i++) {
                const key = settingsToUpdate[i];
                const value = values[i];
                
                await databasePool.execute(
                    `INSERT INTO system_settings (setting_key, setting_value, updated_at) 
                     VALUES (?, ?, NOW())
                     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
                    [key, value]
                );
            }
            
            await BillingLogService.info('billing', 'BillingDashboard', 'Auto billing settings updated', { settings });
            return true;
        } catch (error) {
            await BillingLogService.error('billing', 'BillingDashboard', 'Error updating auto billing settings', error as Error, { settings });
            throw error;
        }
    }
}
