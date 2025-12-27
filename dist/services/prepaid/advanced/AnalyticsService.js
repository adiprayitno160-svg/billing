"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const pool_1 = require("../../../db/pool");
class AnalyticsService {
    /**
     * Get revenue analytics
     */
    async getRevenueAnalytics() {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        // Total revenue
        const [totalRows] = await pool_1.databasePool.query(`SELECT SUM(final_price) as total_revenue 
       FROM prepaid_subscriptions_v2`);
        const totalRevenue = parseFloat(totalRows[0]?.total_revenue || 0);
        // Today revenue
        const [todayRows] = await pool_1.databasePool.query(`SELECT SUM(final_price) as today_revenue 
       FROM prepaid_subscriptions_v2 
       WHERE DATE(activation_date) = CURDATE()`);
        const todayRevenue = parseFloat(todayRows[0]?.today_revenue || 0);
        // This month revenue
        const [thisMonthRows] = await pool_1.databasePool.query(`SELECT SUM(final_price) as this_month_revenue 
       FROM prepaid_subscriptions_v2 
       WHERE activation_date >= ?`, [thisMonthStart]);
        const thisMonthRevenue = parseFloat(thisMonthRows[0]?.this_month_revenue || 0);
        // Last month revenue
        const [lastMonthRows] = await pool_1.databasePool.query(`SELECT SUM(final_price) as last_month_revenue 
       FROM prepaid_subscriptions_v2 
       WHERE activation_date >= ? AND activation_date <= ?`, [lastMonthStart, lastMonthEnd]);
        const lastMonthRevenue = parseFloat(lastMonthRows[0]?.last_month_revenue || 0);
        // Calculate growth
        const revenueGrowth = lastMonthRevenue > 0
            ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
            : 0;
        // Average transaction value
        const [avgRows] = await pool_1.databasePool.query(`SELECT AVG(final_price) as avg_value 
       FROM prepaid_subscriptions_v2`);
        const avgTransactionValue = parseFloat(avgRows[0]?.avg_value || 0);
        return {
            total_revenue: totalRevenue,
            today_revenue: todayRevenue,
            this_month_revenue: thisMonthRevenue,
            last_month_revenue: lastMonthRevenue,
            revenue_growth: revenueGrowth,
            average_transaction_value: avgTransactionValue
        };
    }
    /**
     * Get usage analytics
     */
    async getUsageAnalytics() {
        const [usageRows] = await pool_1.databasePool.query(`SELECT 
        SUM(total_gb) as total_data_used_gb,
        AVG(total_gb) as avg_daily_usage_gb,
        MAX(log_date) as peak_usage_date,
        (SELECT log_hour FROM prepaid_usage_logs 
         GROUP BY log_hour ORDER BY SUM(total_gb) DESC LIMIT 1) as peak_usage_hour
       FROM prepaid_usage_logs`);
        const [activeRows] = await pool_1.databasePool.query(`SELECT COUNT(*) as active_count 
       FROM prepaid_subscriptions_v2 
       WHERE status = 'active'`);
        return {
            total_data_used_gb: parseFloat(usageRows[0]?.total_data_used_gb || 0),
            average_daily_usage_gb: parseFloat(usageRows[0]?.avg_daily_usage_gb || 0),
            peak_usage_hour: usageRows[0]?.peak_usage_hour || 0,
            peak_usage_date: usageRows[0]?.peak_usage_date ? new Date(usageRows[0].peak_usage_date) : null,
            total_active_subscriptions: parseInt(activeRows[0]?.active_count || 0)
        };
    }
    /**
     * Get customer analytics
     */
    async getCustomerAnalytics() {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        // Total customers
        const [totalRows] = await pool_1.databasePool.query(`SELECT COUNT(*) as total 
       FROM customers 
       WHERE connection_type = 'prepaid'`);
        const totalCustomers = parseInt(totalRows[0]?.total || 0);
        // Active customers (have active subscription)
        const [activeRows] = await pool_1.databasePool.query(`SELECT COUNT(DISTINCT customer_id) as active 
       FROM prepaid_subscriptions_v2 
       WHERE status = 'active'`);
        const activeCustomers = parseInt(activeRows[0]?.active || 0);
        // New customers today
        const [todayRows] = await pool_1.databasePool.query(`SELECT COUNT(*) as new_today 
       FROM customers 
       WHERE connection_type = 'prepaid' AND DATE(created_at) = CURDATE()`);
        const newCustomersToday = parseInt(todayRows[0]?.new_today || 0);
        // New customers this month
        const [monthRows] = await pool_1.databasePool.query(`SELECT COUNT(*) as new_month 
       FROM customers 
       WHERE connection_type = 'prepaid' AND created_at >= ?`, [thisMonthStart]);
        const newCustomersThisMonth = parseInt(monthRows[0]?.new_month || 0);
        // Churn rate (customers with expired subscriptions vs total)
        const [churnRows] = await pool_1.databasePool.query(`SELECT 
        COUNT(DISTINCT customer_id) as expired_customers
       FROM prepaid_subscriptions_v2 
       WHERE status IN ('expired', 'cancelled') 
         AND expiry_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`);
        const expiredCustomers = parseInt(churnRows[0]?.expired_customers || 0);
        const churnRate = totalCustomers > 0 ? (expiredCustomers / totalCustomers) * 100 : 0;
        // Customer lifetime value (average revenue per customer)
        const [ltvRows] = await pool_1.databasePool.query(`SELECT AVG(customer_revenue) as avg_ltv 
       FROM (
         SELECT customer_id, SUM(final_price) as customer_revenue 
         FROM prepaid_subscriptions_v2 
         GROUP BY customer_id
       ) as revenue_per_customer`);
        const customerLTV = parseFloat(ltvRows[0]?.avg_ltv || 0);
        return {
            total_customers: totalCustomers,
            active_customers: activeCustomers,
            new_customers_today: newCustomersToday,
            new_customers_this_month: newCustomersThisMonth,
            churn_rate: churnRate,
            customer_lifetime_value: customerLTV
        };
    }
    /**
     * Get package performance
     */
    async getPackagePerformance(limit = 10) {
        const [rows] = await pool_1.databasePool.query(`SELECT 
        p.id as package_id,
        p.name as package_name,
        COUNT(s.id) as total_sales,
        SUM(s.final_price) as total_revenue,
        AVG(s.final_price) as average_price,
        (COUNT(s.id) * AVG(s.final_price)) as popularity_score
       FROM prepaid_packages_v2 p
       LEFT JOIN prepaid_subscriptions_v2 s ON p.id = s.package_id
       GROUP BY p.id, p.name
       ORDER BY popularity_score DESC
       LIMIT ?`, [limit]);
        return rows.map(row => ({
            package_id: row.package_id,
            package_name: row.package_name,
            total_sales: parseInt(row.total_sales || 0),
            total_revenue: parseFloat(row.total_revenue || 0),
            average_price: parseFloat(row.average_price || 0),
            popularity_score: parseFloat(row.popularity_score || 0)
        }));
    }
    /**
     * Update daily analytics
     */
    async updateDailyAnalytics(date = new Date()) {
        const analyticsDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        // Calculate metrics for the day
        const revenue = await this.getRevenueAnalytics();
        const usage = await this.getUsageAnalytics();
        const customers = await this.getCustomerAnalytics();
        // Insert or update daily analytics
        await pool_1.databasePool.query(`INSERT INTO prepaid_analytics_daily (
        analytics_date,
        total_active_subscriptions,
        total_new_subscriptions,
        total_revenue,
        total_data_used_gb,
        avg_usage_per_customer_gb,
        total_active_customers,
        total_new_customers,
        churn_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_active_subscriptions = VALUES(total_active_subscriptions),
        total_new_subscriptions = VALUES(total_new_subscriptions),
        total_revenue = VALUES(total_revenue),
        total_data_used_gb = VALUES(total_data_used_gb),
        avg_usage_per_customer_gb = VALUES(avg_usage_per_customer_gb),
        total_active_customers = VALUES(total_active_customers),
        total_new_customers = VALUES(total_new_customers),
        churn_rate = VALUES(churn_rate),
        updated_at = NOW()`, [
            analyticsDate,
            usage.total_active_subscriptions,
            0, // New subscriptions today - calculate separately
            revenue.today_revenue,
            usage.total_data_used_gb,
            usage.average_daily_usage_gb,
            customers.active_customers,
            customers.new_customers_today,
            customers.churn_rate
        ]);
    }
    /**
     * Get analytics dashboard data
     */
    async getDashboardData() {
        return {
            revenue: await this.getRevenueAnalytics(),
            usage: await this.getUsageAnalytics(),
            customers: await this.getCustomerAnalytics(),
            top_packages: await this.getPackagePerformance(5)
        };
    }
}
exports.AnalyticsService = AnalyticsService;
exports.default = new AnalyticsService();
//# sourceMappingURL=AnalyticsService.js.map