/**
 * Unified Notification Service
 * Centralized notification service for all billing events
 * Integrated with WhatsApp and other channels
 */
export type NotificationType = 'invoice_created' | 'invoice_sent' | 'invoice_overdue' | 'invoice_reminder' | 'payment_received' | 'payment_partial' | 'payment_failed' | 'referral_reward' | 'maintenance_scheduled' | 'service_restored' | 'service_blocked' | 'service_unblocked' | 'customer_created' | 'customer_deleted' | 'customer_migrated_to_postpaid' | 'payment_debt' | 'isolation_warning' | 'payment_shortage_warning' | 'pre_block_warning';
export type NotificationChannel = 'whatsapp' | 'email' | 'sms' | 'push';
export interface NotificationData {
    customer_id: number;
    subscription_id?: number;
    invoice_id?: number;
    payment_id?: number;
    notification_type: NotificationType;
    variables: Record<string, any>;
    channels?: NotificationChannel[];
    scheduled_for?: Date;
    priority?: 'low' | 'normal' | 'high';
}
export declare class UnifiedNotificationService {
    /**
     * Queue notification for sending
     */
    static queueNotification(data: NotificationData): Promise<number[]>;
    /**
     * Send pending notifications
     */
    static sendPendingNotifications(limit?: number): Promise<{
        sent: number;
        failed: number;
        skipped: number;
    }>;
    /**
     * Send notification via appropriate channel
     */
    private static sendNotification;
    /**
     * Mark notification as failed
     */
    private static markAsFailed;
    /**
     * Mark notification as skipped
     */
    private static markAsSkipped;
    /**
     * Send invoice created notification
     */
    static notifyInvoiceCreated(invoiceId: number): Promise<void>;
    /**
     * Send invoice overdue notification
     */
    static notifyInvoiceOverdue(invoiceId: number): Promise<void>;
    /**
     * Send payment received notification
     */
    static notifyPaymentReceived(paymentId: number): Promise<void>;
    /**
     * Get notification statistics
     */
    static getStatistics(days?: number): Promise<{
        total: number;
        sent: number;
        failed: number;
        pending: number;
        skipped: number;
        by_type: Record<string, number>;
        by_channel: Record<string, number>;
    }>;
}
//# sourceMappingURL=UnifiedNotificationService.d.ts.map