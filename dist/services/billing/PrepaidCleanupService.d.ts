/**
 * Prepaid Cleanup Service
 * Handles cleanup and reminder tasks for prepaid payments
 */
export declare class PrepaidCleanupService {
    /**
     * Auto-expire payment requests older than 1 hour
     */
    static expireOldPaymentRequests(): Promise<void>;
    /**
     * Send reminder for pending payments (30 minutes after creation)
     */
    static sendPendingPaymentReminders(): Promise<void>;
    /**
     * Send payment reminder to customer
     */
    private static sendPaymentReminder;
    /**
     * Delete old expired/verified payment requests (> 30 days)
     */
    static deleteOldPaymentRequests(): Promise<void>;
    /**
     * Get cleanup statistics
     */
    static getCleanupStats(): Promise<{
        pending_count: number;
        expired_count: number;
        verified_count: number;
        old_records_count: number;
    }>;
    /**
     * Run all cleanup tasks
     */
    static runAllCleanupTasks(): Promise<void>;
}
//# sourceMappingURL=PrepaidCleanupService.d.ts.map