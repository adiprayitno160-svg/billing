/**
 * Unified Notification Service
 * Centralized notification service for all billing events
 * Integrated with WhatsApp and other channels
 */
export type NotificationType = 'invoice_created' | 'invoice_sent' | 'invoice_overdue' | 'invoice_reminder' | 'payment_received' | 'payment_partial' | 'payment_failed' | 'referral_reward' | 'maintenance_scheduled' | 'service_restored' | 'service_suspended' | 'service_blocked' | 'service_blocked_system' | 'service_unblocked' | 'customer_created' | 'customer_deleted' | 'customer_migrated_to_postpaid' | 'payment_debt' | 'isolation_warning' | 'payment_shortage_warning' | 'pre_block_warning' | 'payment_reminder' | 'payment_deferment' | 'broadcast' | 'technician_job' | 'invoice_reminder_manual' | 'invoice_reminder_upcoming' | 'invoice_due_today' | 'invoice_overdue_1' | 'invoice_overdue_2' | 'invoice_overdue_monthly';
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
    attachment_path?: string;
    send_immediately?: boolean;
}
export declare class UnifiedNotificationService {
    /**
     * Queue notification for sending
     */
    static queueNotification(data: NotificationData): Promise<number[]>;
    /**
     * Send a specific notification by its ID (Immediate/Manual Dispatch)
     * This is used by controllers for "Direct Action" buttons to ensure
     * the message is sent immediately and we wait for the result.
     */
    static sendNotificationById(notificationId: number): Promise<boolean>;
    /**
     * Process pending notifications
     */
    static sendPendingNotifications(limit?: number, specificIds?: number[]): Promise<{
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
    static notifyInvoiceCreated(invoiceId: number, sendImmediately?: boolean): Promise<number[]>;
    /**
     * Helper to generate invoice PDF
     */
    static generateInvoicePdf(invoiceId: number): Promise<string | undefined>;
    /**
     * Send invoice overdue notification
     */
    static notifyInvoiceOverdue(invoiceId: number): Promise<void>;
    /**
     * Send invoice reminder (Monthly 20th)
     */
    static notifyInvoiceReminder(invoiceId: number): Promise<void>;
    /**
     * Get Bank Settings
     */
    private static getBankSettings;
    /**
     * Send payment received notification
     */
    static notifyPaymentReceived(paymentId: number, sendImmediately?: boolean): Promise<number[]>;
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
    /**
     * Broadcast message to all Admins/Operators
     */
    static broadcastToAdmins(message: string): Promise<void>;
}
//# sourceMappingURL=UnifiedNotificationService.d.ts.map