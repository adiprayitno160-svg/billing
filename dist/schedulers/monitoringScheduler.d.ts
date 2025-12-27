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
    start(): void;
    /**
     * Stop all schedulers
     */
    stop(): void;
    /**
     * 1. Static IP Ping Monitoring - Every 10 minutes
     */
    private startPingMonitoring;
    /**
     * 2. PPPoE Bandwidth Collection - Every 5 minutes
     */
    private startBandwidthCollection;
    /**
     * 3. SLA Monitoring & Incident Detection - Every 5 minutes
     */
    private startSLAMonitoring;
    /**
     * 4. Daily Summary Report - Every day at 8:00 AM
     */
    private startDailySummaryReport;
    /**
     * 5. Monthly SLA Calculation - 1st day of month at 2:00 AM
     */
    private startMonthlySLACalculation;
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