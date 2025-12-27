import { RowDataPacket } from 'mysql2';
/**
 * Complete Prepaid Scheduler Service
 * Auto check expiry, send notifications, deactivate expired subscriptions
 */
declare class PrepaidSchedulerServiceComplete {
    private isRunning;
    private interval;
    /**
     * Initialize scheduler - runs every 1 hour
     */
    initialize(): void;
    /**
     * Stop scheduler
     */
    stop(): void;
    /**
     * Main scheduler function
     */
    runScheduler(): Promise<void>;
    /**
     * Deactivate expired subscriptions
     */
    private deactivateExpiredSubscriptions;
    /**
     * Send expiry notifications
     */
    private sendExpiryNotifications;
    /**
     * Restore renewed customers (remove from portal-redirect)
     */
    private restoreRenewedCustomers;
    /**
     * Deactivate customer in MikroTik
     */
    private deactivateInMikrotik;
    /**
     * Remove from portal redirect
     */
    private removeFromPortalRedirect;
    /**
     * Enable PPPoE user in MikroTik
     */
    private enablePPPoEUser;
    /**
     * Send expired notification via WhatsApp
     */
    private sendExpiredNotification;
    /**
     * Create expiry reminder message
     */
    private createExpiryReminderMessage;
    /**
     * Get statistics
     */
    getStatistics(): Promise<RowDataPacket | {
        active_customers: number;
        expired_customers: number;
        expiring_soon: number;
        total_revenue_today: number;
    } | undefined>;
    /**
     * Manual trigger for testing
     */
    triggerManually(): Promise<{
        success: boolean;
        message: string;
    }>;
}
declare const _default: PrepaidSchedulerServiceComplete;
export default _default;
//# sourceMappingURL=PrepaidSchedulerServiceComplete.d.ts.map