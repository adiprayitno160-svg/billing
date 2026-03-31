/**
 * Notification Scheduler
 * Automatically processes and sends pending notifications
 */
interface ProcessResult {
    sent: number;
    failed: number;
    skipped: number;
}
export declare class NotificationScheduler {
    private static cronJob;
    private static isRunning;
    private static lastRunTime;
    private static readonly WORK_DURATION_MS;
    private static readonly REST_DURATION_MS;
    private static cycleStartTime;
    private static isResting;
    private static restStartTime;
    private static totalSentInCycle;
    /**
     * Check if the scheduler is in rest period (anti-spam)
     */
    private static checkWorkRestCycle;
    /**
     * Initialize scheduler
     */
    static initialize(): void;
    /**
     * Check and notify overdue invoices
     */
    private static checkOverdueInvoices;
    /**
     * Check and notify monthly reminders (20th)
     */
    private static checkMonthlyInvoiceReminders;
    /**
     * Cleanup old notification logs
     */
    private static cleanupOldLogs;
    /**
     * Stop scheduler
     */
    static stop(): void;
    /**
     * Retry failed notifications that haven't exceeded max retries
     */
    private static retryFailedNotifications;
    /**
     * Manually trigger notification processing
     */
    static processNow(): Promise<ProcessResult>;
}
export {};
//# sourceMappingURL=NotificationScheduler.d.ts.map