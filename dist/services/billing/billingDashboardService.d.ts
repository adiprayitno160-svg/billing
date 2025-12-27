import { RowDataPacket } from 'mysql2';
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
export declare class BillingDashboardService {
    /**
     * Get comprehensive billing statistics
     */
    static getBillingStatistics(): Promise<BillingStatistics>;
    /**
     * Get billing trends for charts
     */
    static getBillingTrends(days?: number): Promise<BillingTrend[]>;
    /**
     * Get customer payment behavior
     */
    static getCustomerPaymentBehavior(): Promise<CustomerPaymentBehavior[]>;
    /**
     * Get overdue customers for quick action
     */
    static getOverdueCustomers(limit?: number): Promise<OverdueCustomer[]>;
    /**
     * Get recent billing activities
     */
    static getRecentBillingActivities(limit?: number): Promise<BillingActivity[]>;
    /**
     * Get system health metrics
     */
    static getSystemHealthMetrics(): Promise<SystemHealthMetrics>;
    /**
     * Get SLA statistics
     */
    static getSlaStatistics(): Promise<SlaStatistics>;
    /**
     * Search customers for quick actions
     */
    static searchCustomers(searchTerm: string, limit?: number): Promise<CustomerSearchResult[]>;
    /**
     * Get dashboard summary for quick overview
     */
    static getDashboardSummary(): Promise<DashboardSummary>;
    /**
     * Update auto billing settings
     */
    static updateAutoBillingSettings(settings: {
        auto_isolate?: boolean;
        auto_restore?: boolean;
        auto_notifications?: boolean;
    }): Promise<boolean>;
}
export {};
//# sourceMappingURL=billingDashboardService.d.ts.map