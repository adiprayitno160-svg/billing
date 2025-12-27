"use strict";
/**
 * Usage Tracking Service
 *
 * Tracks and analyzes customer usage data:
 * - Real-time usage monitoring
 * - Hourly usage logs
 * - Quota management
 * - Usage analytics
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageTrackingService = void 0;
const pool_1 = require("../../../db/pool");
const AdvancedSubscriptionService_1 = __importDefault(require("./AdvancedSubscriptionService"));
const mikrotikConfigHelper_1 = require("../../../utils/mikrotikConfigHelper");
const MikrotikService_1 = require("../../mikrotik/MikrotikService");
class UsageTrackingService {
    /**
     * Log usage data for a subscription
     */
    async logUsage(subscriptionId, customerId, usage) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const now = new Date();
            const logDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const logHour = now.getHours();
            const downloadGb = usage.download_bytes / (1024 * 1024 * 1024);
            const uploadGb = usage.upload_bytes / (1024 * 1024 * 1024);
            const totalGb = downloadGb + uploadGb;
            // Insert or update usage log
            await connection.query(`INSERT INTO prepaid_usage_logs (
          subscription_id, customer_id, log_date, log_hour,
          download_bytes, upload_bytes, total_bytes,
          download_gb, upload_gb, total_gb,
          session_count, peak_download_mbps, peak_upload_mbps,
          avg_download_mbps, avg_upload_mbps
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          download_bytes = download_bytes + VALUES(download_bytes),
          upload_bytes = upload_bytes + VALUES(upload_bytes),
          total_bytes = total_bytes + VALUES(total_bytes),
          download_gb = download_gb + VALUES(download_gb),
          upload_gb = upload_gb + VALUES(upload_gb),
          total_gb = total_gb + VALUES(total_gb),
          session_count = session_count + VALUES(session_count),
          peak_download_mbps = GREATEST(peak_download_mbps, VALUES(peak_download_mbps)),
          peak_upload_mbps = GREATEST(peak_upload_mbps, VALUES(peak_upload_mbps)),
          avg_download_mbps = (avg_download_mbps + VALUES(avg_download_mbps)) / 2,
          avg_upload_mbps = (avg_upload_mbps + VALUES(avg_upload_mbps)) / 2,
          updated_at = NOW()`, [
                subscriptionId,
                customerId,
                logDate,
                logHour,
                usage.download_bytes,
                usage.upload_bytes,
                usage.download_bytes + usage.upload_bytes,
                downloadGb,
                uploadGb,
                totalGb,
                usage.session_count || 1,
                usage.peak_download_mbps || 0,
                usage.peak_upload_mbps || 0,
                usage.avg_download_mbps || 0,
                usage.avg_upload_mbps || 0
            ]);
            // Update subscription usage
            await this.updateSubscriptionUsage(subscriptionId, totalGb);
        }
        catch (error) {
            console.error('Error logging usage:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Update subscription usage totals
     */
    async updateSubscriptionUsage(subscriptionId, additionalGb) {
        const subscription = await AdvancedSubscriptionService_1.default.getSubscriptionById(subscriptionId);
        if (!subscription) {
            return;
        }
        const newUsed = (subscription.data_used_gb || 0) + additionalGb;
        const remaining = subscription.data_quota_gb
            ? Math.max(0, subscription.data_quota_gb - newUsed)
            : null;
        await pool_1.databasePool.query(`UPDATE prepaid_subscriptions_v2 
       SET data_used_gb = ?,
           data_remaining_gb = ?,
           status = CASE 
             WHEN ? IS NOT NULL AND ? <= 0 THEN 'depleted'
             ELSE status
           END
       WHERE id = ?`, [newUsed, remaining, subscription.data_quota_gb, remaining, subscriptionId]);
        // Check if quota depleted
        if (subscription.data_quota_gb && remaining !== null && remaining <= 0) {
            // Handle quota depletion
            await this.handleQuotaDepletion(subscriptionId);
        }
    }
    /**
     * Get usage statistics for subscription
     */
    async getUsageStats(subscriptionId) {
        const subscription = await AdvancedSubscriptionService_1.default.getSubscriptionById(subscriptionId);
        if (!subscription) {
            return null;
        }
        // Get total usage
        const [usageRows] = await pool_1.databasePool.query(`SELECT 
        SUM(download_gb) as total_download_gb,
        SUM(upload_gb) as total_upload_gb,
        SUM(total_gb) as total_usage_gb,
        MAX(log_date) as last_usage_date
      FROM prepaid_usage_logs
      WHERE subscription_id = ?`, [subscriptionId]);
        const usage = usageRows[0] || {};
        const totalDownload = parseFloat(usage.total_download_gb || 0);
        const totalUpload = parseFloat(usage.total_upload_gb || 0);
        const totalUsage = parseFloat(usage.total_usage_gb || 0);
        // Calculate remaining quota
        const quotaRemaining = subscription.data_quota_gb
            ? Math.max(0, subscription.data_quota_gb - totalUsage)
            : Infinity;
        const quotaPercentage = subscription.data_quota_gb
            ? (totalUsage / subscription.data_quota_gb) * 100
            : 0;
        // Calculate days remaining
        const now = new Date();
        const expiry = new Date(subscription.expiry_date);
        const daysRemaining = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        // Calculate average daily usage
        const activationDate = new Date(subscription.activation_date);
        const daysActive = Math.max(1, Math.ceil((now.getTime() - activationDate.getTime()) / (1000 * 60 * 60 * 24)));
        const avgDailyUsage = totalUsage / daysActive;
        // Get peak usage
        const [peakRows] = await pool_1.databasePool.query(`SELECT log_date, log_hour, MAX(total_gb) as peak_gb
       FROM prepaid_usage_logs
       WHERE subscription_id = ?
       GROUP BY log_date, log_hour
       ORDER BY peak_gb DESC
       LIMIT 1`, [subscriptionId]);
        const peak = peakRows[0] || null;
        return {
            total_download_gb: totalDownload,
            total_upload_gb: totalUpload,
            total_usage_gb: totalUsage,
            quota_remaining_gb: quotaRemaining === Infinity ? -1 : quotaRemaining,
            quota_percentage_used: quotaPercentage,
            days_remaining: daysRemaining,
            avg_daily_usage_gb: avgDailyUsage,
            peak_usage_date: peak ? new Date(peak.log_date) : null,
            peak_usage_hour: peak ? peak.log_hour : null
        };
    }
    /**
     * Get usage history for date range
     */
    async getUsageHistory(subscriptionId, startDate, endDate) {
        const [rows] = await pool_1.databasePool.query(`SELECT * FROM prepaid_usage_logs
       WHERE subscription_id = ? 
         AND log_date >= ? 
         AND log_date <= ?
       ORDER BY log_date DESC, log_hour DESC`, [subscriptionId, startDate, endDate]);
        return rows.map(row => this.mapRowToUsageLog(row));
    }
    /**
     * Sync usage from MikroTik
     */
    async syncUsageFromMikrotik(subscriptionId) {
        const subscription = await AdvancedSubscriptionService_1.default.getSubscriptionById(subscriptionId);
        if (!subscription) {
            throw new Error('Subscription not found');
        }
        const config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
        if (!config) {
            throw new Error('MikroTik configuration not found');
        }
        const mikrotikService = new MikrotikService_1.MikrotikService({
            host: config.host,
            port: config.port || config.api_port || 8728,
            username: config.username,
            password: config.password
        });
        // Get customer info
        const [customerRows] = await pool_1.databasePool.query('SELECT * FROM customers WHERE id = ?', [subscription.customer_id]);
        if (customerRows.length === 0) {
            throw new Error('Customer not found');
        }
        const customer = customerRows[0];
        // Fetch usage from MikroTik
        // This depends on your MikroTik implementation
        // Example: Get PPPoE user statistics or interface statistics
        // For now, this is a placeholder
        // You would implement actual MikroTik API calls here
        console.log(`Syncing usage for subscription ${subscriptionId} from MikroTik`);
    }
    /**
     * Handle quota depletion
     */
    async handleQuotaDepletion(subscriptionId) {
        // Update subscription status
        await pool_1.databasePool.query(`UPDATE prepaid_subscriptions_v2 
       SET status = 'depleted' 
       WHERE id = ?`, [subscriptionId]);
        // Revert MikroTik configuration (suspend access)
        const subscription = await AdvancedSubscriptionService_1.default.getSubscriptionById(subscriptionId);
        if (subscription) {
            // This would trigger notification and suspend access
            console.log(`Quota depleted for subscription ${subscriptionId}`);
        }
    }
    /**
     * Map database row to usage log object
     */
    mapRowToUsageLog(row) {
        return {
            id: row.id,
            subscription_id: row.subscription_id,
            customer_id: row.customer_id,
            log_date: new Date(row.log_date),
            log_hour: row.log_hour,
            download_bytes: parseInt(row.download_bytes) || 0,
            upload_bytes: parseInt(row.upload_bytes) || 0,
            total_bytes: parseInt(row.total_bytes) || 0,
            download_gb: parseFloat(row.download_gb) || 0,
            upload_gb: parseFloat(row.upload_gb) || 0,
            total_gb: parseFloat(row.total_gb) || 0,
            session_count: row.session_count || 0,
            peak_download_mbps: parseFloat(row.peak_download_mbps) || 0,
            peak_upload_mbps: parseFloat(row.peak_upload_mbps) || 0,
            avg_download_mbps: parseFloat(row.avg_download_mbps) || 0,
            avg_upload_mbps: parseFloat(row.avg_upload_mbps) || 0
        };
    }
}
exports.UsageTrackingService = UsageTrackingService;
exports.default = new UsageTrackingService();
//# sourceMappingURL=UsageTrackingService.js.map