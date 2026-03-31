/**
 * Expiry Reminder Service
 * Handles expiry reminder notifications (H-3, H-1, expired)
 */
export declare class ExpiryReminderService {
    /**
     * Send H-3 reminder (3 days before expiry)
     */
    static sendH3Reminders(): Promise<void>;
    /**
     * Send H-1 reminder (1 day before expiry)
     */
    static sendH1Reminders(): Promise<void>;
    /**
     * Send expired notification
     */
    static sendExpiredNotifications(): Promise<void>;
    /**
     * Send reminder message
     */
    private static sendReminder;
    /**
     * Clean up old notification logs (> 90 days)
     */
    static cleanupOldLogs(): Promise<void>;
    /**
     * Get notification history for customer
     */
    static getNotificationHistory(customerId: number, limit?: number): Promise<any[]>;
}
//# sourceMappingURL=ExpiryReminderService.d.ts.map