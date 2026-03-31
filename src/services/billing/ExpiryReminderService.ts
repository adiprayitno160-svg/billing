/**
 * Expiry Reminder Service
 * Handles expiry reminder notifications (H-3, H-1, expired)
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { whatsappService } from '../whatsapp/WhatsAppService';

export class ExpiryReminderService {
    /**
     * Send H-3 reminder (3 days before expiry)
     */
    static async sendH3Reminders(): Promise<void> {
        try {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 3);
            const targetDateStr = targetDate.toISOString().split('T')[0];

            // Get customers expiring in 3 days who haven't received H-3 reminder
            const [customers] = await databasePool.query<RowDataPacket[]>(
                `SELECT c.* 
                FROM customers c
                LEFT JOIN expiry_notifications en ON c.id = en.customer_id 
                    AND en.notification_type = 'h_minus_3' 
                    AND en.expiry_date = DATE(c.expiry_date)
                WHERE c.billing_mode = 'prepaid'
                AND c.status = 'active'
                AND DATE(c.expiry_date) = ?
                AND en.id IS NULL`,
                [targetDateStr]
            );

            console.log(`[ExpiryReminder] Found ${customers.length} customers for H-3 reminder`);

            for (const customer of customers) {
                await this.sendReminder(customer, 'h_minus_3');
            }
        } catch (error) {
            console.error('[ExpiryReminder] Error sending H-3 reminders:', error);
        }
    }

    /**
     * Send H-1 reminder (1 day before expiry)
     */
    static async sendH1Reminders(): Promise<void> {
        try {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 1);
            const targetDateStr = targetDate.toISOString().split('T')[0];

            // Get customers expiring tomorrow who haven't received H-1 reminder
            const [customers] = await databasePool.query<RowDataPacket[]>(
                `SELECT c.* 
                FROM customers c
                LEFT JOIN expiry_notifications en ON c.id = en.customer_id 
                    AND en.notification_type = 'h_minus_1' 
                    AND en.expiry_date = DATE(c.expiry_date)
                WHERE c.billing_mode = 'prepaid'
                AND c.status = 'active'
                AND DATE(c.expiry_date) = ?
                AND en.id IS NULL`,
                [targetDateStr]
            );

            console.log(`[ExpiryReminder] Found ${customers.length} customers for H-1 reminder`);

            for (const customer of customers) {
                await this.sendReminder(customer, 'h_minus_1');
            }
        } catch (error) {
            console.error('[ExpiryReminder] Error sending H-1 reminders:', error);
        }
    }

    /**
     * Send expired notification
     */
    static async sendExpiredNotifications(): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Get customers expired today who haven't received expired notification
            const [customers] = await databasePool.query<RowDataPacket[]>(
                `SELECT c.* 
                FROM customers c
                LEFT JOIN expiry_notifications en ON c.id = en.customer_id 
                    AND en.notification_type = 'expired' 
                    AND en.expiry_date = DATE(c.expiry_date)
                WHERE c.billing_mode = 'prepaid'
                AND DATE(c.expiry_date) = ?
                AND en.id IS NULL`,
                [today]
            );

            console.log(`[ExpiryReminder] Found ${customers.length} customers expired today`);

            for (const customer of customers) {
                await this.sendReminder(customer, 'expired');
            }
        } catch (error) {
            console.error('[ExpiryReminder] Error sending expired notifications:', error);
        }
    }

    /**
     * Send reminder message
     */
    private static async sendReminder(
        customer: any,
        notificationType: 'h_minus_3' | 'h_minus_1' | 'expired'
    ): Promise<void> {
        try {
            const expiryDate = new Date(customer.expiry_date);
            const formattedDate = expiryDate.toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            let message = '';

            if (notificationType === 'h_minus_3') {
                message = `📅 *REMINDER: Masa Aktif Anda Akan Berakhir*\n\n` +
                    `Halo *${customer.name}*,\n\n` +
                    `Masa aktif internet Anda akan berakhir dalam *3 hari* pada:\n` +
                    `📆 ${formattedDate}\n\n` +
                    `Agar tidak terganggu, segera perpanjang dengan ketik:\n` +
                    `📱 */beli*\n\n` +
                    `Terima kasih! 🙏`;
            } else if (notificationType === 'h_minus_1') {
                message = `⚠️ *URGENT: Masa Aktif Besok Berakhir!*\n\n` +
                    `Halo *${customer.name}*,\n\n` +
                    `⏰ Masa aktif internet Anda akan berakhir *BESOK*:\n` +
                    `📆 ${formattedDate}\n\n` +
                    `🚨 *SEGERA PERPANJANG SEKARANG!*\n` +
                    `Ketik: */beli*\n\n` +
                    `Jangan sampai internet Anda terputus! 🙏`;
            } else if (notificationType === 'expired') {
                message = `❌ *Masa Aktif Telah Berakhir*\n\n` +
                    `Halo *${customer.name}*,\n\n` +
                    `Masa aktif internet Anda telah berakhir pada:\n` +
                    `📆 ${formattedDate}\n\n` +
                    `Untuk aktivasi kembali, silakan top-up dengan ketik:\n` +
                    `📱 */beli*\n\n` +
                    `Terima kasih atas pengertiannya! 🙏`;
            }

            // Send WhatsApp message
            const waClient = whatsappService;
            let success = false;
            let messageId = null;

            try {
                await waClient.sendMessage(customer.phone, message);
                success = true;
                messageId = 'unknown'; // whatsapp-web.js doesn't easily return ID on send
            } catch (e) {
                console.error("[ExpiryReminder] Failed to send message:", e);
            }

            // Log notification
            await databasePool.query(
                `INSERT INTO expiry_notifications 
                (customer_id, notification_type, expiry_date, wa_message_id, status) 
                VALUES (?, ?, ?, ?, ?)`,
                [
                    customer.id,
                    notificationType,
                    expiryDate.toISOString().split('T')[0],
                    messageId,
                    success ? 'sent' : 'failed'
                ]
            );

            if (success) {
                console.log(`[ExpiryReminder] Sent ${notificationType} reminder to ${customer.name} (${customer.phone})`);
            } else {
                console.error(`[ExpiryReminder] Failed to send ${notificationType} reminder to ${customer.name}`);
            }

        } catch (error) {
            console.error('[ExpiryReminder] Error sending reminder:', error);
        }
    }

    /**
     * Clean up old notification logs (> 90 days)
     */
    static async cleanupOldLogs(): Promise<void> {
        try {
            const [result] = await databasePool.query<ResultSetHeader>(
                `DELETE FROM expiry_notifications WHERE sent_at < DATE_SUB(NOW(), INTERVAL 90 DAY)`
            );

            console.log(`[ExpiryReminder] Cleaned up ${result.affectedRows} old notification logs`);
        } catch (error) {
            console.error('[ExpiryReminder] Error cleaning up logs:', error);
        }
    }

    /**
     * Get notification history for customer
     */
    static async getNotificationHistory(customerId: number, limit: number = 10): Promise<any[]> {
        try {
            const [notifications] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM expiry_notifications 
                WHERE customer_id = ? 
                ORDER BY sent_at DESC
                LIMIT ?`,
                [customerId, limit]
            );

            return notifications;
        } catch (error) {
            console.error('[ExpiryReminder] Error fetching notification history:', error);
            return [];
        }
    }
}
