import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { whatsappService, WhatsAppService } from '../whatsapp/WhatsAppService';

export interface OfflineCustomer {
    id: number;
    name: string;
    customer_code: string;
    phone: string;
    pppoe_username?: string;
    connection_type: string;
    last_seen_online: Date;
    offline_since: Date;
}

export class OfflineNotificationService {
    private static instance: OfflineNotificationService;
    private waClient: WhatsAppService;

    private constructor() {
        this.waClient = whatsappService;
    }

    static getInstance(): OfflineNotificationService {
        if (!OfflineNotificationService.instance) {
            OfflineNotificationService.instance = new OfflineNotificationService();
        }
        return OfflineNotificationService.instance;
    }

    /**
     * Process customers that have been offline for 30+ minutes
     * Send notification only 1x per offline incident
     */
    async processOfflineCustomers(): Promise<void> {
        console.log('[OfflineNotification] Processing offline customers (30+ mins)...');

        try {
            // Find customers that have been offline for 30+ minutes
            const offlineCustomers = await this.getOfflineCustomers();

            for (const customer of offlineCustomers) {
                await this.handleOfflineCustomerNotification(customer);
            }

            console.log(`[OfflineNotification] Processed ${offlineCustomers.length} offline customers`);
        } catch (error) {
            console.error('[OfflineNotification] Error processing offline customers:', error);
        }
    }

    /**
     * Find customers that have been offline for 30+ minutes
     */
    private async getOfflineCustomers(): Promise<OfflineCustomer[]> {
        try {
            // Query to find customers that have been offline for 30+ minutes
            const query = `
                SELECT 
                    c.id,
                    c.name,
                    c.customer_code,
                    c.phone,
                    c.pppoe_username,
                    c.connection_type,
                    COALESCE(cl.timestamp, c.updated_at) as last_seen_online,
                    COALESCE(cl.timestamp, c.updated_at) as offline_since
                FROM customers c
                LEFT JOIN (
                    -- Get the last online status for each customer
                    SELECT 
                        customer_id,
                        MAX(timestamp) as timestamp
                    FROM connection_logs 
                    WHERE status = 'online'
                    GROUP BY customer_id
                ) cl ON c.id = cl.customer_id
                WHERE 
                    c.status = 'active'
                    AND c.phone IS NOT NULL 
                    AND c.phone != ''
                    AND c.notification_enabled = 1
                    AND c.name NOT LIKE '%nanik%'
                    AND c.name NOT LIKE '%Nanik%'
                    AND c.name NOT LIKE '%NANTIK%'
                    AND c.name NOT LIKE '%nantik%'
                    AND (
                        -- Check if there's no recent online status (offline since last record)
                        cl.timestamp IS NULL 
                        OR 
                        -- Check if the last online status was more than 30 minutes ago
                        cl.timestamp < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
                    )
                    AND NOT EXISTS (
                        -- Make sure customer is currently offline
                        SELECT 1 
                        FROM connection_logs cl2 
                        WHERE cl2.customer_id = c.id 
                            AND cl2.status = 'online' 
                            AND cl2.timestamp > COALESCE(cl.timestamp, c.updated_at)
                    )
                ORDER BY cl.timestamp ASC
            `;

            const [rows] = await databasePool.query<RowDataPacket[]>(query);

            return rows.map(row => ({
                id: row.id,
                name: row.name,
                customer_code: row.customer_code,
                phone: row.phone,
                pppoe_username: row.pppoe_username,
                connection_type: row.connection_type,
                last_seen_online: new Date(row.last_seen_online),
                offline_since: new Date(row.offline_since)
            }));
        } catch (error) {
            console.error('[OfflineNotification] Error getting offline customers:', error);
            return [];
        }
    }

    /**
     * Handle notification for a specific offline customer
     */
    private async handleOfflineCustomerNotification(customer: OfflineCustomer): Promise<void> {
        try {
            // Check if we need to send a notification (only 1x per incident)
            const shouldNotify = await this.shouldSendNotification(customer);

            if (!shouldNotify) {
                return;
            }

            // Send notification to customer
            const notificationSent = await this.sendOfflineNotification(customer);
            
            // Log the notification regardless of WA success, so we don't spam trying to send WA
            await this.logNotificationEvent({
                customer_id: customer.id,
                event_type: 'offline_30min',
                severity: 'medium',
                message: `Customer ${customer.name} notified for 30+ mins offline. WA Sent: ${notificationSent}`,
                details: {
                    offline_duration_mins: Math.floor((Date.now() - customer.offline_since.getTime()) / (1000 * 60)),
                    wa_sent: notificationSent
                },
                notified_at: new Date()
            });

            console.log(`[OfflineNotification] Sent 30-min offline notification to ${customer.name}. WA Sent: ${notificationSent}`);

            // Send notification to Telegram Admins
            try {
                const telegramAdminService = (await import('../telegram/TelegramAdminService')).default;
                await telegramAdminService.sendNotification({
                    type: 'downtime',
                    priority: 'high',
                    title: `🔴 Pelanggan Offline > 30 Menit`,
                    message: `Pelanggan *${customer.name}* (ID: ${customer.customer_code}) telah terpantau OFFLINE selama lebih dari 30 menit.\n\n` + 
                             (notificationSent ? `✅ Notifikasi WhatsApp otomatis telah dikirimkan ke pelanggan.` : `⚠️ Gagal mengirim WA otomatis (nomor tidak valid/kosong).`),
                    targetRole: 'admin',
                    customerId: customer.id
                });
                console.log(`[OfflineNotification] Sent Telegram admin alert for ${customer.name}`);
            } catch (telegramErr) {
                console.error('[OfflineNotification] Failed to send Telegram alert to admins:', telegramErr);
            }
        } catch (error) {
            console.error(`[OfflineNotification] Error handling notification for customer ${customer.id}:`, error);
        }
    }

    /**
     * Check if notification should be sent (1x per offline incident)
     */
    private async shouldSendNotification(customer: OfflineCustomer): Promise<boolean> {
        try {
            // Check last notification time for this customer and event type
            const [lastNotification] = await databasePool.query<RowDataPacket[]>(`
                SELECT notified_at 
                FROM customer_notification_events 
                WHERE customer_id = ? 
                    AND event_type = 'offline_30min'
                ORDER BY notified_at DESC 
                LIMIT 1
            `, [customer.id]);

            if (lastNotification.length === 0) {
                // First notification ever, send it
                return true;
            }

            const lastNotified = new Date(lastNotification[0].notified_at);
            
            // If the last notification was sent AFTER they went offline, it means we ALREADY
            // notified them for THIS specific downtime incident.
            if (lastNotified > customer.offline_since) {
                return false;
            }

            // Otherwise, they went offline again AFTER the last notification,
            // or the last notification was sent before this downtime.
            return true;
        } catch (error) {
            console.error('[OfflineNotification] Error checking notification cooldown:', error);
            return true; // Send notification if we can't check
        }
    }

    /**
     * Log notification event to database
     */
    private async logNotificationEvent(event: {
        customer_id: number;
        event_type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        message: string;
        details?: any;
        notified_at: Date;
    }): Promise<void> {
        try {
            await databasePool.query(`
                INSERT INTO customer_notification_events 
                (customer_id, event_type, severity, message, details, notified_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                event.customer_id,
                event.event_type,
                event.severity,
                event.message,
                event.details ? JSON.stringify(event.details) : null,
                event.notified_at
            ]);
        } catch (error) {
            console.error('[OfflineNotification] Failed to log notification event:', error);
        }
    }

    /**
     * Send offline notification to customer
     */
    private async sendOfflineNotification(customer: OfflineCustomer): Promise<boolean> {
        try {
            if (!customer.phone) {
                console.log(`[OfflineNotification] Skipping notification for ${customer.name} - no phone number`);
                return false;
            }

            // Exact template from manual notification (views/monitoring/enhanced-network-map.ejs)
            const message = `Halo ${customer.name},\n` +
`Kami dari Admin Internet menginformasikan bahwa koneksi internet di rumah Anda saat ini terdeteksi OFFLINE / Terputus.\n\n` +
`Untuk pengecekan awal, mohon bantuan untuk:\n` +
`1. Pastikan perangkat modem/ONT dalam keadaan menyala.\n` +
`2. Periksa apakah ada lampu berwarna MERAH yang menyala/berkedip pada modem (biasanya di lampu LOS).\n` +
`3. Cobalah me-restart modem dengan cara mencabut adaptor/power supply selama 10 detik, lalu colokkan kembali.\n\n` +
`Jika setelah 5 menit koneksi masih belum terhubung atau masih ada lampu merah, silakan langsung hubungi nomor Admin kami agar segera kami tindaklanjuti.\n\n` +
`Terima kasih atas kerja samanya.`;

            await this.waClient.sendMessage(customer.phone, message);
            return true;
        } catch (error) {
            console.error(`[OfflineNotification] Failed to send offline notification to ${customer.name}:`, error);
            return false;
        }
    }
}
