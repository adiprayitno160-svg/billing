/**
 * Analytics Service
 *
 * Provides analytics and insights:
 * - Revenue analytics
 * - Usage analytics
 * - Customer analytics
 * - Package performance
 * - Real-time dashboards
 */
export interface RevenueAnalytics {
    total_revenue: number;
    today_revenue: number;
    this_month_revenue: number;
    last_month_revenue: number;
    revenue_growth: number;
    average_transaction_value: number;
}
export interface UsageAnalytics {
    total_data_used_gb: number;
    average_daily_usage_gb: number;
    peak_usage_hour: number;
    peak_usage_date: Date | null;
    total_active_subscriptions: number;
}
export interface CustomerAnalytics {
    total_customers: number;
    active_customers: number;
    new_customers_today: number;
    new_customers_this_month: number;
    churn_rate: number;
    customer_lifetime_value: number;
}
export interface PackagePerformance {
    package_id: number;
    package_name: string;
    total_sales: number;
    total_revenue: number;
    average_price: number;
    popularity_score: number;
}
export declare class AnalyticsService {
    /**
     * Get revenue analytics
     */
    getRevenueAnalytics(): Promise<RevenueAnalytics>;
    /**
     * Get usage analytics
     */
    getUsageAnalytics(): Promise<UsageAnalytics>;
    /**
     * Get customer analytics
     */
    getCustomerAnalytics(): Promise<CustomerAnalytics>;
    /**
     * Get package performance
     */
    getPackagePerformance(limit?: number): Promise<PackagePerformance[]>;
    /**
     * Update daily analytics
     */
    updateDailyAnalytics(date?: Date): Promise<void>;
    /**
     * Get analytics dashboard data
     */
    getDashboardData(): Promise<{
        revenue: RevenueAnalytics;
        usage: UsageAnalytics;
        customers: CustomerAnalytics;
        top_packages: PackagePerformance[];
    }>;
}
declare const _default: AnalyticsService;
export default _default;
//# sourceMappingURL=AnalyticsService.d.ts.map