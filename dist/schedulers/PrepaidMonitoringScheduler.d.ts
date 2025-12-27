/**
 * Scheduler untuk monitoring prepaid subscriptions
 * Auto-detect expired packages dan revert Mikrotik configuration
 * Runs every 5 minutes
 */
declare class PrepaidMonitoringScheduler {
    private task;
    private isRunning;
    /**
     * Start the scheduler
     */
    start(): void;
    /**
     * Stop the scheduler
     */
    stop(): void;
    /**
     * Check for expired subscriptions and deactivate them
     */
    private checkExpiredSubscriptions;
    /**
     * Send expiry notification to customer (via WhatsApp/SMS)
     */
    private sendExpiryNotification;
    /**
     * Manual trigger untuk testing
     */
    runManually(): Promise<{
        processed: number;
        success: boolean;
    }>;
    /**
     * Get scheduler status
     */
    getStatus(): {
        running: boolean;
        isProcessing: boolean;
    };
    /**
     * Check subscriptions expiring soon (in next 24 hours)
     */
    checkExpiringSoon(): Promise<any[]>;
    /**
     * Send reminder notification before expiry
     */
    private sendReminderNotification;
}
declare const prepaidMonitoringScheduler: PrepaidMonitoringScheduler;
export default prepaidMonitoringScheduler;
//# sourceMappingURL=PrepaidMonitoringScheduler.d.ts.map