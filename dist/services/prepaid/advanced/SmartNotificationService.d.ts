/**
 * Smart Notification Service
 *
 * Handles intelligent notifications:
 * - Multi-channel notifications (Email, SMS, WhatsApp, Push)
 * - Scheduled notifications
 * - Notification templates
 * - Retry logic
 * - Notification preferences
 */
export type NotificationType = 'package_expiring' | 'package_expired' | 'quota_warning' | 'quota_depleted' | 'package_activated' | 'payment_required' | 'auto_renew_success' | 'auto_renew_failed' | 'voucher_applied' | 'referral_reward';
export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'push' | 'all';
export interface Notification {
    id?: number;
    customer_id: number;
    subscription_id?: number;
    notification_type: NotificationType;
    channel: NotificationChannel;
    title: string;
    message: string;
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
    sent_at?: Date;
    retry_count?: number;
    error_message?: string;
    scheduled_for?: Date;
}
export interface NotificationTemplate {
    type: NotificationType;
    title_template: string;
    message_template: string;
    channels: NotificationChannel[];
}
export declare class SmartNotificationService {
    private templates;
    /**
     * Queue notification
     */
    queueNotification(customerId: number, subscriptionId: number | undefined, type: NotificationType, data?: Record<string, any>, channels?: NotificationChannel[], scheduledFor?: Date): Promise<number>;
    /**
     * Send pending notifications
     */
    sendPendingNotifications(limit?: number): Promise<number>;
    /**
     * Send notification via appropriate channel
     */
    private sendNotification;
    /**
     * Send WhatsApp notification
     */
    private sendWhatsApp;
    /**
     * Send Email notification
     */
    private sendEmail;
    /**
     * Send SMS notification
     */
    private sendSMS;
    /**
     * Send Push notification
     */
    private sendPush;
    /**
     * Schedule notification for package expiry
     */
    schedulePackageExpiryNotifications(subscriptionId: number): Promise<void>;
    /**
     * Schedule quota warning notifications
     */
    scheduleQuotaWarningNotifications(subscriptionId: number): Promise<void>;
}
declare const _default: SmartNotificationService;
export default _default;
//# sourceMappingURL=SmartNotificationService.d.ts.map