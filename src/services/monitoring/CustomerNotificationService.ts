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
import telegramAdminService from '../telegram/TelegramAdminService';

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
    static_ip?: string;
    odc_id?: number;
    odp_id?: number;
    address?: string;
    odp_name?: string;
}

export class CustomerNotificationService {
    private static instance: CustomerNotificationService;
    private waClient: WhatsAppService;
    private adminBroadcastCooldowns: Map<string, number> = new Map();

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
        // DISABLED: Monitoring notifications disabled per user request to reduce spam
        console.log(`[Notification] SKIPPED ${eventType} notification for ${customer.name} (Service Disabled)`);
        return false;
    }

    /**
     * Send AI-Generated Automated Troubleshooting Notification
     */
    async sendAIAutomatedTroubleshooting(customer: CustomerInfo, eventType: string): Promise<boolean> {
        // DISABLED: AI Troubleshooting notifications disabled per user request
        console.log(`[AI-Notification] SKIPPED AI troubleshooting for ${customer.name} (Service Disabled)`);
        return false;
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
        // DISABLED: Escalation notifications disabled per user request
        console.log(`[Notification] SKIPPED escalation for ${eventType} (${affectedCustomers} affected) (Service Disabled)`);
        return;
    }

    /**
     * Broadcast customer status change to Admins & Operators via Telegram
     */
    async broadcastCustomerStatusToAdmins(
        customer: CustomerInfo,
        status: 'offline' | 'online'
    ): Promise<void> {
        // DISABLED: Customer status broadcasts to admin disabled per user request to reduce spam
        console.log(`[Notification] SKIPPED admin broadcast for ${customer.name} status ${status} (Service Disabled)`);
        return;
    }

    private formatDuration(minutes: number): string {
        if (minutes < 60) {
            return `${minutes} Menit`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins === 0) {
            return `${hours} Jam`;
        }
        return `${hours} Jam ${mins} Menit`;
    }

    /**
     * Broadcast Infrastructure (ODP/ODC) Mass Outage to Admins & Operators
     * Used when multiple customers in the same ODP go offline simultaneously
     */
    async broadcastInfrastructureIssue(
        locationName: string,
        type: 'ODP' | 'ODC',
        status: 'offline' | 'online',
        affectedCount: number,
        details?: {
            odcName?: string;
            totalCount?: number;
            affectedCustomers?: string[];
            durationMinutes?: number;
        }
    ): Promise<void> {
        console.log(`[Notification] Sending NMS Alert for ${type} ${locationName} status ${status}`);
        try {
            const nowStr = new Date().toLocaleDateString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }) + ' ' + new Date().toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            }) + ' WIB';

            let emptyPortsText = '';
            if (type === 'ODP') {
                try {
                    const [odpRows] = await databasePool.query<RowDataPacket[]>(
                        `SELECT total_ports, used_ports FROM ftth_odp WHERE name = ?`,
                        [locationName]
                    );
                    if (odpRows.length > 0) {
                        const total = odpRows[0].total_ports || 0;
                        const used = odpRows[0].used_ports || 0;
                        const empty = total - used;
                        emptyPortsText = `\n🔌 Port Kosong: ${empty} dari ${total}`;
                    }
                } catch (dbErr) {
                    console.error('[Notification] Error fetching ODP ports:', dbErr);
                }
            }

            let message = '';
            let title = '';

            if (status === 'offline') {
                title = `NMS ALERT — ${type} DOWN`;
                if (type === 'ODP') {
                    const odcStr = details?.odcName ? ` (berinduk ke ${details.odcName})` : '';
                    const percent = details?.totalCount ? Math.round((affectedCount / details.totalCount) * 100) : 50;
                    const customersList = details?.affectedCustomers && details.affectedCustomers.length > 0 
                        ? details.affectedCustomers.map(c => `• ${c}`).join('\n') 
                        : '• Tidak ada data pelanggan aktif';
                    message = `📍 ODP: ${locationName}${odcStr}\n` +
                              `🔴 Status: DOWN (${percent}% Offline)\n` +
                              `👥 Klien Offline: ${affectedCount} dari ${details?.totalCount || '?'}${emptyPortsText}\n` +
                              `⏰ Waktu: ${nowStr}\n\n` +
                              `📋 Pelanggan Terdampak:\n${customersList}\n\n` +
                              `💡 Cek: Putus listrik atau kabel distribusi?`;
                } else {
                    message = `📍 ODC: ${locationName}\n` +
                              `🔴 Status: DOWN (Semua ODP Mati)\n` +
                              `⏰ Waktu: ${nowStr}\n\n` +
                              `💡 Cek: Kabel backbone putus, OLT down, atau pemadaman listrik massal?`;
                }

                await telegramAdminService.sendNotification({
                    type: 'downtime',
                    priority: 'critical',
                    title: title,
                    message: message,
                    targetRole: 'all'
                });
            } else {
                title = `NMS RECOVERY — ${type} NORMAL`;
                const durationStr = details?.durationMinutes ? this.formatDuration(details.durationMinutes) : 'Beberapa saat';
                if (type === 'ODP') {
                    message = `📍 ODP: ${locationName}\n` +
                              `🟢 Status: NORMAL (Semua Online)${emptyPortsText}\n` +
                              `⏱️ Durasi Gangguan: ${durationStr}\n` +
                              `⏰ Pulih: ${nowStr}`;
                } else {
                    message = `📍 ODC: ${locationName}\n` +
                              `🟢 Status: NORMAL (Semua Online)\n` +
                              `⏱️ Durasi Gangguan: ${durationStr}\n` +
                              `⏰ Pulih: ${nowStr}`;
                }

                await telegramAdminService.sendNotification({
                    type: 'downtime',
                    priority: 'medium',
                    title: title,
                    message: message,
                    targetRole: 'all'
                });
            }
        } catch (err) {
            console.error('[Notification] Error sending NMS Telegram notification:', err);
        }
    }
}

export default CustomerNotificationService.getInstance();