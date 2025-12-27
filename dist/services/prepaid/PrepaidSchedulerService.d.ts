/**
 * Scheduler service untuk prepaid system
 * - Check expired packages
 * - Send expiry reminders
 * - Auto-suspend expired customers
 */
declare class PrepaidSchedulerService {
    private expiryCheckTask;
    private reminderTask;
    /**
     * Initialize all schedulers
     */
    initialize(): Promise<void>;
    /**
     * Check and suspend expired packages
     */
    checkExpiredPackages(): Promise<{
        processed: number;
        suspended: number;
    }>;
    /**
     * Send expiry reminders to customers expiring soon
     */
    sendExpiryReminders(): Promise<number>;
    /**
     * Get statistics for active prepaid customers
     */
    getStatistics(): Promise<any>;
    /**
     * Manual trigger untuk expiry check (untuk testing)
     */
    triggerExpiryCheck(): Promise<any>;
    /**
     * Manual trigger untuk reminder check (untuk testing)
     */
    triggerReminderCheck(): Promise<number>;
    /**
     * Stop all schedulers
     */
    stop(): void;
    /**
     * Get list of customers needing portal redirect
     */
    getCustomersNeedingRedirect(): Promise<any[]>;
    /**
     * Auto-add customers to portal redirect if no active package
     */
    autoManagePortalRedirect(): Promise<{
        added: number;
        removed: number;
    }>;
}
declare const _default: PrepaidSchedulerService;
export default _default;
//# sourceMappingURL=PrepaidSchedulerService.d.ts.map