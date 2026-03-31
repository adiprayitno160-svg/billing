export declare class SchedulerService {
    private static isInitialized;
    private static autoIsolationJobs;
    private static invoiceGenerationJobs;
    private static paymentReminderJob;
    private static overdueNotificationJob;
    /**
     * Initialize all scheduled tasks
     */
    static initialize(): void;
    /**
     * Send invoice notifications via WhatsApp
     */
    private static sendInvoiceNotifications;
    /**
     * Send payment reminders
     */
    private static sendPaymentReminders;
    /**
     * Send overdue notifications
     */
    private static sendOverdueNotifications;
    /**
     * Calculate SLA and apply discounts
     */
    private static calculateSlaAndApplyDiscounts;
    /**
     * Manual trigger for invoice generation
     */
    static triggerMonthlyInvoices(period: string): Promise<number[]>;
    /**
     * Manual trigger for auto isolation
     */
    static triggerAutoIsolation(): Promise<{
        isolated: number;
        failed: number;
    }>;
    /**
     * Manual trigger for auto restore
     */
    static triggerAutoRestore(): Promise<{
        restored: number;
        failed: number;
    }>;
    /**
     * Get scheduler status
     */
    static getStatus(): {
        isRunning: boolean;
        initialized: boolean;
        tasks: string[];
        lastRun?: string;
        nextRun?: string;
        totalJobs?: number;
    };
    private static scheduleInvoiceGeneration;
    private static applyInvoiceScheduleFromDb;
    static updateInvoiceSchedule(daysOfMonth: number[], isActive?: boolean, hour?: number, minute?: number): Promise<{
        days: number[];
        isActive: boolean;
        hour: number;
        minute: number;
    }>;
    private static schedulePaymentReminders;
    private static scheduleOverdueNotifications;
    private static applyReminderScheduleFromDb;
    private static applyOverdueScheduleFromDb;
    static updateNotificationSettings({ paymentReminderActive, overdueNotificationActive }: {
        paymentReminderActive?: boolean;
        overdueNotificationActive?: boolean;
    }): Promise<void>;
    /**
     * Schedule Auto Isolation jobs for given days of month (default 00:00 Asia/Jakarta)
     * HARUS dijalankan SEBELUM generate tagihan baru
     */
    private static scheduleAutoIsolation;
    /**
     * Read Auto Isolation schedule from DB and apply
     * We store comma-separated days in scheduler_settings.cron_schedule for task_name='auto_isolation'
     */
    private static applyAutoIsolationScheduleFromDb;
    /**
     * Update Auto Isolation schedule and re-schedule jobs
     */
    static updateAutoIsolationSchedule(daysOfMonth: number[], isActive?: boolean, hour?: number, minute?: number): Promise<{
        days: number[];
        isActive: boolean;
        hour: number;
        minute: number;
    }>;
}
//# sourceMappingURL=scheduler.d.ts.map