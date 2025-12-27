"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartNotificationService = void 0;
const pool_1 = require("../../../db/pool");
const AdvancedSubscriptionService_1 = __importDefault(require("./AdvancedSubscriptionService"));
class SmartNotificationService {
    constructor() {
        this.templates = new Map([
            [
                'package_expiring',
                {
                    type: 'package_expiring',
                    title_template: 'Paket Internet Anda Akan Berakhir',
                    message_template: 'Paket internet Anda akan berakhir dalam {days} hari. Segera perpanjang untuk menghindari gangguan layanan.',
                    channels: ['whatsapp', 'email']
                }
            ],
            [
                'package_expired',
                {
                    type: 'package_expired',
                    title_template: 'Paket Internet Anda Telah Berakhir',
                    message_template: 'Paket internet Anda telah berakhir. Silakan beli paket baru untuk melanjutkan layanan.',
                    channels: ['whatsapp', 'email', 'sms']
                }
            ],
            [
                'quota_warning',
                {
                    type: 'quota_warning',
                    title_template: 'Peringatan: Kuota Internet Anda Hampir Habis',
                    message_template: 'Kuota internet Anda tersisa {remaining_gb} GB ({percentage}%). Segera top up untuk menghindari gangguan layanan.',
                    channels: ['whatsapp', 'email']
                }
            ],
            [
                'quota_depleted',
                {
                    type: 'quota_depleted',
                    title_template: 'Kuota Internet Anda Habis',
                    message_template: 'Kuota internet Anda telah habis. Layanan telah ditangguhkan. Silakan beli paket baru.',
                    channels: ['whatsapp', 'email', 'sms']
                }
            ],
            [
                'package_activated',
                {
                    type: 'package_activated',
                    title_template: 'Paket Internet Aktif',
                    message_template: 'Paket internet Anda telah diaktifkan! Nikmati layanan internet dengan kecepatan {speed} Mbps selama {duration} hari.',
                    channels: ['whatsapp', 'email']
                }
            ],
            [
                'auto_renew_success',
                {
                    type: 'auto_renew_success',
                    title_template: 'Paket Otomatis Diperpanjang',
                    message_template: 'Paket internet Anda telah diperpanjang secara otomatis menggunakan saldo deposit.',
                    channels: ['whatsapp', 'email']
                }
            ],
            [
                'auto_renew_failed',
                {
                    type: 'auto_renew_failed',
                    title_template: 'Gagal Perpanjangan Otomatis',
                    message_template: 'Gagal memperpanjang paket secara otomatis. Saldo deposit tidak mencukupi. Silakan top up deposit atau beli paket manual.',
                    channels: ['whatsapp', 'email', 'sms']
                }
            ]
        ]);
    }
    /**
     * Queue notification
     */
    async queueNotification(customerId, subscriptionId, type, data = {}, channels = ['all'], scheduledFor) {
        const template = this.templates.get(type);
        if (!template) {
            throw new Error(`No template found for notification type: ${type}`);
        }
        // Replace template variables
        let title = template.title_template;
        let message = template.message_template;
        for (const [key, value] of Object.entries(data)) {
            title = title.replace(`{${key}}`, String(value));
            message = message.replace(`{${key}}`, String(value));
        }
        // Determine channels
        const notificationChannels = channels.includes('all') ? template.channels : channels;
        const connection = await pool_1.databasePool.getConnection();
        try {
            let notificationIds = [];
            // Create notification for each channel
            for (const channel of notificationChannels) {
                const [result] = await connection.query(`INSERT INTO prepaid_notifications_queue (
            customer_id, subscription_id, notification_type,
            channel, title, message, status, scheduled_for
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`, [
                    customerId,
                    subscriptionId || null,
                    type,
                    channel,
                    title,
                    message,
                    scheduledFor || null
                ]);
                notificationIds.push(result.insertId);
            }
            return notificationIds[0] || 0; // Return first notification ID
        }
        finally {
            connection.release();
        }
    }
    /**
     * Send pending notifications
     */
    async sendPendingNotifications(limit = 50) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            // Get pending notifications that are due
            const [notifications] = await connection.query(`SELECT * FROM prepaid_notifications_queue 
         WHERE status = 'pending' 
           AND (scheduled_for IS NULL OR scheduled_for <= NOW())
         ORDER BY created_at ASC
         LIMIT ?`, [limit]);
            let sent = 0;
            for (const notif of notifications) {
                try {
                    await this.sendNotification(notif);
                    await connection.query(`UPDATE prepaid_notifications_queue 
             SET status = 'sent', sent_at = NOW() 
             WHERE id = ?`, [notif.id]);
                    sent++;
                }
                catch (error) {
                    const retryCount = (notif.retry_count || 0) + 1;
                    if (retryCount < 3) {
                        // Retry
                        await connection.query(`UPDATE prepaid_notifications_queue 
               SET retry_count = ?, error_message = ? 
               WHERE id = ?`, [retryCount, error.message, notif.id]);
                    }
                    else {
                        // Mark as failed
                        await connection.query(`UPDATE prepaid_notifications_queue 
               SET status = 'failed', error_message = ? 
               WHERE id = ?`, [error.message, notif.id]);
                    }
                }
            }
            return sent;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Send notification via appropriate channel
     */
    async sendNotification(notification) {
        switch (notification.channel) {
            case 'whatsapp':
                await this.sendWhatsApp(notification);
                break;
            case 'email':
                await this.sendEmail(notification);
                break;
            case 'sms':
                await this.sendSMS(notification);
                break;
            case 'push':
                await this.sendPush(notification);
                break;
            default:
                throw new Error(`Unsupported channel: ${notification.channel}`);
        }
    }
    /**
     * Send WhatsApp notification
     */
    async sendWhatsApp(notification) {
        // Get customer phone
        const [customerRows] = await pool_1.databasePool.query('SELECT phone FROM customers WHERE id = ?', [notification.customer_id]);
        if (customerRows.length === 0 || !customerRows[0]?.phone) {
            throw new Error('Customer phone not found');
        }
        const phone = customerRows[0].phone;
        const message = `${notification.title}\n\n${notification.message}`;
        try {
            const { WhatsAppService } = await Promise.resolve().then(() => __importStar(require('../../whatsapp/WhatsAppService')));
            const result = await WhatsAppService.sendMessage(phone, message, {
                customerId: notification.customer_id,
                template: notification.template || 'smart_notification'
            });
            if (result.success) {
                console.log(`[WhatsApp] ✅ Sent to ${phone}: ${message.substring(0, 50)}...`);
            }
            else {
                console.error(`[WhatsApp] ❌ Failed to send to ${phone}: ${result.error}`);
            }
        }
        catch (error) {
            console.error(`[WhatsApp] Error sending to ${phone}:`, error);
            throw error;
        }
    }
    /**
     * Send Email notification
     */
    async sendEmail(notification) {
        // Get customer email
        const [customerRows] = await pool_1.databasePool.query('SELECT email, name FROM customers WHERE id = ?', [notification.customer_id]);
        if (customerRows.length === 0 || !customerRows[0]?.email) {
            throw new Error('Customer email not found');
        }
        const email = customerRows[0].email;
        const name = customerRows[0].name;
        // TODO: Integrate with email service
        // await emailService.send({
        //   to: email,
        //   subject: notification.title,
        //   html: this.formatEmailTemplate(notification, name)
        // });
        console.log(`[Email] Sending to ${email}: ${notification.title}`);
    }
    /**
     * Send SMS notification
     */
    async sendSMS(notification) {
        // Get customer phone
        const [customerRows] = await pool_1.databasePool.query('SELECT phone FROM customers WHERE id = ?', [notification.customer_id]);
        if (customerRows.length === 0 || !customerRows[0]?.phone) {
            throw new Error('Customer phone not found');
        }
        const phone = customerRows[0].phone;
        const message = `${notification.title}. ${notification.message}`;
        // TODO: Integrate with SMS gateway
        // await smsService.send(phone, message);
        console.log(`[SMS] Sending to ${phone}: ${message.substring(0, 50)}...`);
    }
    /**
     * Send Push notification
     */
    async sendPush(notification) {
        // TODO: Implement push notification (FCM, etc.)
        console.log(`[Push] Sending to customer ${notification.customer_id}: ${notification.title}`);
    }
    /**
     * Schedule notification for package expiry
     */
    async schedulePackageExpiryNotifications(subscriptionId) {
        const subscription = await AdvancedSubscriptionService_1.default.getSubscriptionById(subscriptionId);
        if (!subscription) {
            return;
        }
        const expiryDate = new Date(subscription.expiry_date);
        const now = new Date();
        // Schedule 7 days before expiry
        const warningDate7 = new Date(expiryDate);
        warningDate7.setDate(warningDate7.getDate() - 7);
        // Schedule 3 days before expiry
        const warningDate3 = new Date(expiryDate);
        warningDate3.setDate(warningDate3.getDate() - 3);
        // Schedule 1 day before expiry
        const warningDate1 = new Date(expiryDate);
        warningDate1.setDate(warningDate1.getDate() - 1);
        if (warningDate7 > now) {
            await this.queueNotification(subscription.customer_id, subscriptionId, 'package_expiring', { days: '7' }, ['whatsapp', 'email'], warningDate7);
        }
        if (warningDate3 > now) {
            await this.queueNotification(subscription.customer_id, subscriptionId, 'package_expiring', { days: '3' }, ['whatsapp', 'email'], warningDate3);
        }
        if (warningDate1 > now) {
            await this.queueNotification(subscription.customer_id, subscriptionId, 'package_expiring', { days: '1' }, ['whatsapp', 'email', 'sms'], warningDate1);
        }
    }
    /**
     * Schedule quota warning notifications
     */
    async scheduleQuotaWarningNotifications(subscriptionId) {
        const subscription = await AdvancedSubscriptionService_1.default.getSubscriptionById(subscriptionId);
        if (!subscription || !subscription.data_quota_gb) {
            return;
        }
        // Check quota usage and schedule warnings at 80%, 90%, 95%
        // This would be called from usage tracking service
    }
}
exports.SmartNotificationService = SmartNotificationService;
exports.default = new SmartNotificationService();
//# sourceMappingURL=SmartNotificationService.js.map