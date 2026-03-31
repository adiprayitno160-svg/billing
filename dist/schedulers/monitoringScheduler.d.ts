/**
 * Monitoring Scheduler - Automated Data Collection and SLA Monitoring
 * Uses node-cron for scheduled tasks
 */
export declare class MonitoringScheduler {
    private jobs;
    private isRunning;
    /**
     * Start all monitoring schedulers
     */
    start(): Promise<void>;
    /**
     * Stop all schedulers
     */
    stop(): void;
    private startRealtimeMonitoring;
    /**
     * 1. Static IP Ping Monitoring - Every 10 minutes
     */
    private startPingMonitoring;
    /**
     * 2. PPPoE Bandwidth Collection - Every 5 minutes
     */
    private startBandwidthCollection;
    /**
     * 4. Daily Summary Report - Every day at 8:00 AM
     * Sends both the basic alert summary
     */
    private startDailySummaryReport;
    /**
     * 6. Prepaid Expiry Check - Every hour
     */
    private startPrepaidCheck;
    /**
     * 8. Enhanced Customer Monitoring - Timeout/Recovery Detection - Every 15 minutes
     */
    private startEnhancedCustomerMonitoring;
    /**
     * 9. Two Hour Notification Service - Every 2 hours
     */
    private startTwoHourNotificationService;
    /**
     * 10. GenieACS Device Sync - Every 1 hour
     */
    private startGenieacsSync;
    private startPrepaidExpiryWarnings;
    /**
     * Run specific scheduler manually
     */
    runManually(jobName: string): Promise<void>;
    /**
     * Get scheduler status
     */
    getStatus(): {
        isRunning: boolean;
        jobs: string[];
        nextRuns: {
            [key: string]: string;
        };
    };
}
export declare const monitoringScheduler: MonitoringScheduler;
export default monitoringScheduler;
//# sourceMappingURL=monitoringScheduler.d.ts.map