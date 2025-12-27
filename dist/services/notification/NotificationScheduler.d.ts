/**
 * Notification Scheduler
 * Automatically processes and sends pending notifications
 */
export declare class NotificationScheduler {
    private static cronJob;
    private static isRunning;
    /**
     * Initialize scheduler
     */
    static initialize(): void;
    /**
     * Check and notify overdue invoices
     */
    private static checkOverdueInvoices;
    /**
     * Stop scheduler
     */
    static stop(): void;
    /**
     * Manually trigger notification processing
     */
    static processNow(): Promise<{
        sent: number;
        failed: number;
        skipped: number;
    }>;
}
//# sourceMappingURL=NotificationScheduler.d.ts.map