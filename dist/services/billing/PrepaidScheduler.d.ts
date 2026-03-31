/**
 * Prepaid Scheduler
 * Handles automated tasks for prepaid billing system
 */
export declare class PrepaidScheduler {
    private static expiryCheckJob;
    /**
     * Initialize prepaid scheduler
     */
    static initialize(): void;
    /**
     * Check and disable expired prepaid customers
     */
    static checkExpiredCustomers(): Promise<{
        processed: number;
        disabled: number;
        errors: number;
    }>;
    /**
     * Send expiry notification to customer
     */
    private static sendExpiryNotification;
    /**
     * Stop all scheduled jobs
     */
    static stop(): void;
    /**
     * Get scheduler status
     */
    static getStatus(): {
        running: boolean;
    };
}
//# sourceMappingURL=PrepaidScheduler.d.ts.map