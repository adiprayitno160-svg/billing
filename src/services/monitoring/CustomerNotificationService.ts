/**
 * Customer Notification Service
 * Advanced notification system for customer monitoring events
 * - Timeout/error notifications
 * - Recovery alerts
 * - Escalation policies
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { whatsappService, WhatsAppService } from '../whatsapp/WhatsAppService';
import { ChatBotService } from '../ai/ChatBotService';

interface NotificationEvent {
    customer_id: number;
    event_type: 'offline' | 'timeout' | 'error' | 'recovered' | 'degraded' | string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details?: any;
    notified_at?: Date;
}

interface CustomerInfo {
    id: number;
    name: string;
    customer_code: string;
    phone: string;
    connection_type: string;
    pppoe_username?: string;
    ip_address?: string;
    odc_id?: number;
    odp_id?: number;
    address?: string;
}

export class CustomerNotificationService {
    private static instance: CustomerNotificationService;
    private waClient: WhatsAppService;

    private constructor() {
        this.waClient = whatsappService;
    }

    static getInstance(): CustomerNotificationService {
        if (!CustomerNotificationService.instance) {
            CustomerNotificationService.instance = new CustomerNotificationService();
        }
        return CustomerNotificationService.instance;
    }

    /**
     * Send notification for customer trouble event
     */
    async sendTroubleNotification(
        customer: CustomerInfo,
        eventType: 'offline' | 'timeout' | 'error' | 'recovered' | 'degraded',
        details?: any
    ): Promise<boolean> {
        try {
            if (!customer.phone) {
                console.log(`[Notification] Skipping ${customer.name} - no phone number`);
                return false;
            }

            // Check if customer has notification preferences
            const shouldNotify = await this.shouldSendNotification(customer.id, eventType);
            if (!shouldNotify) {
                console.log(`[Notification] Suppressed notification for customer ${customer.id}`);
                return false;
            }

            let message = '';
            let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

            switch (eventType) {
                case 'offline':
                    message = `⚠️ *PEMBERITAHUAN GANGGUAN KONEKSI*\n\n` +
                        `Pelanggan Yth,\n` +
                        `Koneksi internet Anda saat ini terdeteksi *OFFLINE*.\n\n` +
                        `📋 Informasi:\n` +
                        `• Nama: ${customer.name}\n` +
                        `• ID: ${customer.customer_code}\n` +
                        `• Jenis: ${customer.connection_type.toUpperCase()}\n\n` +
                        `Tim teknis kami sedang memeriksa kendala ini.\n` +
                        `Mohon maaf atas ketidaknyamanannya.`;
                    severity = 'high';
                    break;

                case 'timeout':
                    message = `⏰ *PERINGATAN TIMEOUT KONEKSI*\n\n` +
                        `Pelanggan ${customer.name} (${customer.customer_code}),\n` +
                        `Koneksi Anda mengalami *TIMEOUT* berkepanjangan.\n\n` +
                        `Tim kami sedang mengecek penyebabnya.`;
                    severity = 'medium';
                    break;

                case 'error':
                    message = `🔧 *DETEKSI ERROR KONEKSI*\n\n` +
                        `Pelanggan ${customer.name} (${customer.customer_code}),\n` +
                        `Terjadi error pada koneksi Anda: ${details?.error || 'Unknown error'}\n\n` +
                        `Sedang dalam penanganan teknis.`;
                    severity = 'high';
                    break;

                case 'degraded':
                    message = `📉 *PERINGATAN KUALITAS KONEKSI*\n\n` +
                        `Pelanggan ${customer.name} (${customer.customer_code}),\n` +
                        `Kualitas koneksi Anda sedang *DEGRADED* (lambat).\n\n` +
                        `Latency: ${details?.latency || '-'}ms\n` +
                        `Packet Loss: ${details?.packetLoss || '-'}%\n\n` +
                        `Tim kami memantau situasi ini.`;
                    severity = 'low';
                    break;

                case 'recovered':
                    message = `✅ *KONEKSI TELAH PULIH*\n\n` +
                        `Pelanggan ${customer.name} (${customer.customer_code}),\n` +
                        `Koneksi internet Anda telah *NORMAL KEMBALI*.\n\n` +
                        `Terima kasih atas kesabarannya.`;
                    severity = 'low';
                    break;
            }

            // Send WhatsApp notification
            await this.waClient.sendMessage(customer.phone, message);

            // Log notification event
            await this.logNotificationEvent({
                customer_id: customer.id,
                event_type: eventType,
                severity,
                message,
                details,
                notified_at: new Date()
            });

            console.log(`[Notification] Sent ${eventType} notification to ${customer.name} (${customer.phone})`);
            return true;

        } catch (error) {
            console.error(`[Notification] Failed to send notification to ${customer.name}:`, error);
            return false;
        }
    }

    /**
     * Send AI-Generated Automated Troubleshooting Notification
     */
    async sendAIAutomatedTroubleshooting(customer: CustomerInfo, eventType: string): Promise<boolean> {
        try {
            if (!customer.phone) return false;

            // Check cooldown to prevent spamming the customer
            const shouldNotify = await this.shouldSendNotification(customer.id, `ai_troubleshoot_${eventType}`);
            if (!shouldNotify) return false;

            console.log(`[AI-Notification] Generating AI troubleshooting for ${customer.name}...`);

            // AI Prompt Construction
            const prompt = `
                Pelanggan ISP kami atas nama: ${customer.name}
                Status: Terdeteksi Terputus (Offline/Timeout)
                Layanan: ${customer.connection_type.toUpperCase()}
                
                Instruksi:
                Pesan ini harus ramah, empati, dan profesional seperti assisten AI ISP.
                1. Ucapkan salam dan informasikan bahwa sistem monitoring kami mendeteksi masalah koneksi di lokasi pelanggan.
                2. Berikan langkah penanggulangan awal:
                   - Periksa lampu indikator pada modem/router (ONT).
                   - Cek apakah kabel terpasang dengan kuat.
                   - Langkah Penting: Matikan modem selama 30 detik, lalu nyalakan kembali (Restart).
                3. Informasikan bahwa tim teknis akan memantau koneksi dalam 5-10 menit.
                4. Jika masih mati, informasikan bahwa tiket perbaikan akan otomatis diteruskan ke tim lapangan.
                5. Gunakan format WhatsApp yang bagus (Bold, Emoji).
                6. Bahasa: Indonesia yang sopan.
            `.trim();

            let aiMessage = '';
            try {
                aiMessage = await ChatBotService.ask(prompt, { status: 'automated_alert' });
            } catch (error) {
                // Fallback if AI fails
                aiMessage = `⚠️ *DETEKSI GANGGUAN KONEKSI*\n\n` +
                    `Halo Kak ${customer.name},\n` +
                    `Sistem monitoring kami mendeteksi koneksi Anda sedang offline.\n\n` +
                    `*Penanggulangan Awal:*\n` +
                    `1. Pastikan kabel power modem terpasang.\n` +
                    `2. Coba matikan modem selama 30 detik lalu nyalakan kembali.\n\n` +
                    `Tim teknik kami sedang memantau. Jika dalam 10 menit masih terkendala, teknisi akan segera meluncur ke lokasi.`;
            }

            // Send via WhatsApp
            await this.waClient.sendMessage(customer.phone, aiMessage);

            // Log event
            await this.logNotificationEvent({
                customer_id: customer.id,
                event_type: `ai_troubleshoot_${eventType}`,
                severity: 'high',
                message: aiMessage,
                notified_at: new Date()
            });

            return true;
        } catch (error) {
            console.error('[AI-Notification] Failed to send AI advice:', error);
            return false;
        }
    }

    /**
     * Check if notification should be sent (respect preferences and cooldown)
     */
    private async shouldSendNotification(customerId: number, eventType: string): Promise<boolean> {
        try {
            // Check customer notification preferences
            const [prefs] = await databasePool.query<RowDataPacket[]>(
                'SELECT notification_enabled, notification_cooldown_hours FROM customers WHERE id = ?',
                [customerId]
            );

            if (prefs.length === 0) return true;

            const customerPref = prefs[0];

            // If notifications disabled for customer
            if (customerPref.notification_enabled === 0) {
                return false;
            }

            // Check cooldown period (prevent spam)
            const cooldownHours = customerPref.notification_cooldown_hours || 1;
            const cooldownMs = cooldownHours * 60 * 60 * 1000;

            const [recentNotifications] = await databasePool.query<RowDataPacket[]>(
                `SELECT id FROM customer_notification_events 
                 WHERE customer_id = ? AND event_type = ? 
                 AND notified_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
                 ORDER BY notified_at DESC LIMIT 1`,
                [customerId, eventType, cooldownHours]
            );

            return recentNotifications.length === 0; // Send if no recent notification

        } catch (error) {
            console.error('[Notification] Error checking notification preference:', error);
            return true; // Default to sending if check fails
        }
    }

    /**
     * Log notification event to database
     */
    private async logNotificationEvent(event: NotificationEvent): Promise<void> {
        try {
            await databasePool.query(
                `INSERT INTO customer_notification_events 
                 (customer_id, event_type, severity, message, details, notified_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    event.customer_id,
                    event.event_type,
                    event.severity,
                    event.message,
                    event.details ? JSON.stringify(event.details) : null,
                    event.notified_at
                ]
            );
        } catch (error) {
            console.error('[Notification] Failed to log notification event:', error);
        }
    }

    /**
     * Get recent notification history for customer
     */
    async getNotificationHistory(customerId: number, limit: number = 10): Promise<any[]> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                `SELECT event_type, severity, notified_at, message
                 FROM customer_notification_events 
                 WHERE customer_id = ?
                 ORDER BY notified_at DESC
                 LIMIT ?`,
                [customerId, limit]
            );
            return rows;
        } catch (error) {
            console.error('[Notification] Error fetching notification history:', error);
            return [];
        }
    }

    /**
     * Bulk send notifications for multiple customers
     */
    async sendBulkNotifications(
        customers: CustomerInfo[],
        eventType: 'offline' | 'timeout' | 'error' | 'recovered' | 'degraded',
        details?: any
    ): Promise<{ success: number; failed: number }> {
        let success = 0;
        let failed = 0;

        for (const customer of customers) {
            try {
                const result = await this.sendTroubleNotification(customer, eventType, details);
                if (result) {
                    success++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`[Notification] Bulk send failed for ${customer.name}:`, error);
                failed++;
            }
        }

        console.log(`[Notification] Bulk send completed: ${success} success, ${failed} failed`);
        return { success, failed };
    }

    /**
     * Send escalation notification to technicians/admins
     */
    async sendEscalationNotification(
        eventType: string,
        affectedCustomers: number,
        details?: any
    ): Promise<void> {
        try {
            // Get admin/technician contacts
            const [admins] = await databasePool.query<RowDataPacket[]>(
                `SELECT phone FROM users 
                 WHERE role IN ('admin', 'technician') 
                 AND phone IS NOT NULL 
                 AND phone != ''`
            );

            if (admins.length === 0) {
                console.log('[Notification] No admin contacts found for escalation');
                return;
            }

            const message = `🚨 *ESCALATION ALERT*\n\n` +
                `Mass issue detected!\n\n` +
                `Event: ${eventType.toUpperCase()}\n` +
                `Affected Customers: ${affectedCustomers}\n` +
                `Time: ${new Date().toLocaleString('id-ID')}\n\n` +
                `Details: ${JSON.stringify(details || {}, null, 2)}`;

            for (const admin of admins) {
                try {
                    await this.waClient.sendMessage(admin.phone as string, message);
                } catch (err) {
                    console.error(`[Notification] Failed to escalate to ${admin.phone}:`, err);
                }
            }

            console.log(`[Notification] Escalation sent to ${admins.length} admins`);
        } catch (error) {
            console.error('[Notification] Error sending escalation:', error);
        }
    }
}

export default CustomerNotificationService.getInstance();