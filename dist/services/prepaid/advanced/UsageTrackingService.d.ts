/**
 * Usage Tracking Service
 *
 * Tracks and analyzes customer usage data:
 * - Real-time usage monitoring
 * - Hourly usage logs
 * - Quota management
 * - Usage analytics
 */
export interface UsageLog {
    id?: number;
    subscription_id: number;
    customer_id: number;
    log_date: Date;
    log_hour: number;
    download_bytes: number;
    upload_bytes: number;
    total_bytes: number;
    download_gb: number;
    upload_gb: number;
    total_gb: number;
    session_count: number;
    peak_download_mbps: number;
    peak_upload_mbps: number;
    avg_download_mbps: number;
    avg_upload_mbps: number;
}
export interface UsageStats {
    total_download_gb: number;
    total_upload_gb: number;
    total_usage_gb: number;
    quota_remaining_gb: number;
    quota_percentage_used: number;
    days_remaining: number;
    avg_daily_usage_gb: number;
    peak_usage_date: Date | null;
    peak_usage_hour: number | null;
}
export declare class UsageTrackingService {
    /**
     * Log usage data for a subscription
     */
    logUsage(subscriptionId: number, customerId: number, usage: {
        download_bytes: number;
        upload_bytes: number;
        session_count?: number;
        peak_download_mbps?: number;
        peak_upload_mbps?: number;
        avg_download_mbps?: number;
        avg_upload_mbps?: number;
    }): Promise<void>;
    /**
     * Update subscription usage totals
     */
    private updateSubscriptionUsage;
    /**
     * Get usage statistics for subscription
     */
    getUsageStats(subscriptionId: number): Promise<UsageStats | null>;
    /**
     * Get usage history for date range
     */
    getUsageHistory(subscriptionId: number, startDate: Date, endDate: Date): Promise<UsageLog[]>;
    /**
     * Sync usage from MikroTik
     */
    syncUsageFromMikrotik(subscriptionId: number): Promise<void>;
    /**
     * Handle quota depletion
     */
    private handleQuotaDepletion;
    /**
     * Map database row to usage log object
     */
    private mapRowToUsageLog;
}
declare const _default: UsageTrackingService;
export default _default;
//# sourceMappingURL=UsageTrackingService.d.ts.map