/**
 * Two Hour Notification Service
 * Handles notifications for customers that have been offline for 2+ hours
 * - Sends notification with ticket number every 2 hours if still down
 * - Sends recovery notification when customer comes back online
 */

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
    current_ticket_id?: number;
    current_ticket_number?: string;
}

export class TwoHourNotificationService {
    private static instance: TwoHourNotificationService;
    private waClient: WhatsAppService;

    private constructor() {
        this.waClient = whatsappService;
    }

    static getInstance(): TwoHourNotificationService {
        if (!TwoHourNotificationService.instance) {
            TwoHourNotificationService.instance = new TwoHourNotificationService();
        }
        return TwoHourNotificationService.instance;
    }

    /**
     * Process customers that have been offline for 2+ hours
     * Send notifications every 2 hours with ticket information
     */
    async processLongTermOfflineCustomers(): Promise<void> {
        console.log('[TwoHourNotification] Processing long-term offline customers...');

        try {
            // Find customers that have been offline for 2+ hours
            const offlineCustomers = await this.getLongTermOfflineCustomers();

            for (const customer of offlineCustomers) {
                await this.handleOfflineCustomerNotification(customer);
            }

            console.log(`[TwoHourNotification] Processed ${offlineCustomers.length} long-term offline customers`);
        } catch (error) {
            console.error('[TwoHourNotification] Error processing long-term offline customers:', error);
        }
    }

    /**
     * Find customers that have been offline for 2+ hours
     */
    private async getLongTermOfflineCustomers(): Promise<OfflineCustomer[]> {
        try {
            // Query to find customers that have been offline for 2+ hours
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
                        -- Check if the last online status was more than 2 hours ago
                        cl.timestamp < DATE_SUB(NOW(), INTERVAL 2 HOUR)
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
            console.error('[TwoHourNotification] Error getting long-term offline customers:', error);
            return [];
        }
    }

    /**
     * Handle notification for a specific offline customer
     */
    private async handleOfflineCustomerNotification(customer: OfflineCustomer): Promise<void> {
        try {
            // Check if we need to send a notification (based on 2-hour intervals)
            const shouldNotify = await this.shouldSendNotification(customer.id, 'offline');

            if (!shouldNotify) {
                return;
            }

            // Get or create a ticket for this customer's issue
            const ticketInfo = await this.getOrCreateTicketForCustomer(customer);

            // Send notification to customer
            const notificationSent = await this.sendOfflineNotification(customer, ticketInfo);

            if (notificationSent) {
                // Log the notification
                await this.logNotificationEvent({
                    customer_id: customer.id,
                    event_type: 'offline_2hour',
                    severity: 'high',
                    message: `Customer ${customer.name} still offline after 2+ hours. Ticket #${ticketInfo.ticket_number} created.`,
                    details: {
                        ticket_id: ticketInfo.ticket_id,
                        ticket_number: ticketInfo.ticket_number,
                        offline_duration_hours: Math.floor((Date.now() - customer.offline_since.getTime()) / (1000 * 60 * 60))
                    },
                    notified_at: new Date()
                });

                console.log(`[TwoHourNotification] Sent 2-hour offline notification to ${customer.name} with ticket #${ticketInfo.ticket_number}`);
            }
        } catch (error) {
            console.error(`[TwoHourNotification] Error handling notification for customer ${customer.id}:`, error);
        }
    }

    /**
     * Send offline notification to customer with ticket information
     */
    private async sendOfflineNotification(customer: OfflineCustomer, ticketInfo: { ticket_id: number, ticket_number: string }): Promise<boolean> {
        try {
            if (!customer.phone) {
                console.log(`[TwoHourNotification] Skipping notification for ${customer.name} - no phone number`);
                return false;
            }

            // Skip notification for Bu Nanik (testing customer)
            if (customer.name.toLowerCase().includes('nanik') || customer.name.toLowerCase().includes('nantik')) {
                console.log(`[TwoHourNotification] Skipping notification for ${customer.name} - testing customer`);
                return false;
            }

            const hoursOffline = Math.floor((Date.now() - customer.offline_since.getTime()) / (1000 * 60 * 60));

            const message = `🚨 *PEMBERITAHUAN GANGGUAN BERLANJUT*\n\n` +
                `Pelanggan Yth. *${customer.name}*,\n` +
                `Koneksi internet Anda masih *OFFLINE* selama lebih dari *${hoursOffline} jam*.\n\n` +
                `📋 *INFORMASI GANGGUAN*:\n` +
                `• ID Pelanggan: ${customer.customer_code}\n` +
                `• Tipe Koneksi: ${customer.connection_type.toUpperCase()}\n` +
                `• Tiket Gangguan: *#${ticketInfo.ticket_number}*\n` +
                `• Waktu Offline: ${customer.offline_since.toLocaleString('id-ID')}\n\n` +
                `🔧 *STATUS PENANGANAN*:\n` +
                `Tim teknisi kami sedang menangani gangguan ini.\n` +
                `Anda akan menerima notifikasi jika ada perkembangan.\n\n` +
                `Terima kasih atas kesabarannya.`;

            await this.waClient.sendMessage(customer.phone, message);
            return true;
        } catch (error) {
            console.error(`[TwoHourNotification] Failed to send offline notification to ${customer.name}:`, error);
            return false;
        }
    }

    /**
     * Send recovery notification when customer comes back online
     */
    async sendRecoveryNotification(customer: OfflineCustomer, ticketNumber: string): Promise<boolean> {
        try {
            if (!customer.phone) {
                console.log(`[TwoHourNotification] Skipping recovery notification for ${customer.name} - no phone number`);
                return false;
            }

            // Skip notification for Bu Nanik (testing customer)
            if (customer.name.toLowerCase().includes('nanik') || customer.name.toLowerCase().includes('nantik')) {
                console.log(`[TwoHourNotification] Skipping recovery notification for ${customer.name} - testing customer`);
                return false;
            }

            const offlineDuration = Math.floor((Date.now() - customer.offline_since.getTime()) / (1000 * 60 * 60));

            const message = `✅ *KONEKSI TELAH PULIH*\n\n` +
                `Pelanggan Yth. *${customer.name}*,\n` +
                `Koneksi internet Anda telah *NORMAL KEMBALI* setelah *${offlineDuration} jam*.\n\n` +
                `📋 *RINGKASAN GANGGUAN*:\n` +
                `• ID Pelanggan: ${customer.customer_code}\n` +
                `• Tiket Gangguan: *#${ticketNumber}*\n` +
                `• Durasi Gangguan: ~${offlineDuration} jam\n\n` +
                `🔄 *Tiket Ditutup*:\n` +
                `Tiket *#${ticketNumber}* telah ditutup secara otomatis.\n\n` +
                `Terima kasih atas kesabarannya.`;

            await this.waClient.sendMessage(customer.phone, message);

            // Log the recovery notification
            await this.logNotificationEvent({
                customer_id: customer.id,
                event_type: 'recovered',
                severity: 'low',
                message: `Customer ${customer.name} recovered. Ticket #${ticketNumber} closed.`,
                details: {
                    ticket_number: ticketNumber,
                    offline_duration_hours: offlineDuration
                },
                notified_at: new Date()
            });

            console.log(`[TwoHourNotification] Sent recovery notification to ${customer.name}. Ticket #${ticketNumber} closed.`);
            return true;
        } catch (error) {
            console.error(`[TwoHourNotification] Failed to send recovery notification to ${customer.name}:`, error);
            return false;
        }
    }

    /**
     * Get or create a ticket for the customer's issue
     */
    private async getOrCreateTicketForCustomer(customer: OfflineCustomer): Promise<{ ticket_id: number, ticket_number: string }> {
        try {
            // Skip ticket creation for Bu Nanik (testing customer)
            if (customer.name.toLowerCase().includes('nanik') || customer.name.toLowerCase().includes('nantik')) {
                console.log(`[TwoHourNotification] Skipping ticket creation for ${customer.name} - testing customer`);
                return {
                    ticket_id: 0,
                    ticket_number: 'TKT-TEST'
                };
            }

            // Check if there's an existing open ticket for this customer's connection issue
            const [existingTickets] = await databasePool.query<RowDataPacket[]>(`
                SELECT tj.id, tj.ticket_number
                FROM technician_jobs tj
                WHERE tj.customer_id = ?
                    AND tj.status IN ('pending', 'accepted', 'in_progress')
                    AND (tj.title LIKE '%koneksi%' OR tj.title LIKE '%offline%' OR tj.title LIKE '%internet%')
                ORDER BY tj.created_at DESC
                LIMIT 1
            `, [customer.id]);

            if (existingTickets.length > 0) {
                return {
                    ticket_id: existingTickets[0].id,
                    ticket_number: existingTickets[0].ticket_number
                };
            }

            // Create a new ticket if none exists
            const ticketNumber = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;

            await databasePool.query(`
                INSERT INTO technician_jobs (
                    ticket_number, 
                    customer_id, 
                    title, 
                    description, 
                    priority, 
                    status, 
                    reported_by,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                ticketNumber,
                customer.id,
                `Koneksi Offline - ${customer.name} (${customer.customer_code})`,
                `Pelanggan ${customer.name} (${customer.customer_code}) mengalami koneksi offline lebih dari 2 jam. Tipe koneksi: ${customer.connection_type}.`,
                'high',
                'pending',
                'system_monitor'
            ]);

            const [newTicket] = await databasePool.query<RowDataPacket[]>(`
                SELECT id FROM technician_jobs WHERE ticket_number = ?
            `, [ticketNumber]);

            console.log(`[TwoHourNotification] Created new ticket #${ticketNumber} for customer ${customer.name}`);

            return {
                ticket_id: newTicket[0].id,
                ticket_number: ticketNumber
            };
        } catch (error) {
            console.error(`[TwoHourNotification] Error getting/creating ticket for customer ${customer.id}:`, error);

            // Return a dummy ticket if we can't create one
            return {
                ticket_id: 0,
                ticket_number: 'TKT-DUMMY'
            };
        }
    }

    /**
     * Check if notification should be sent (respecting cooldown)
     */
    private async shouldSendNotification(customerId: number, eventType: string): Promise<boolean> {
        try {
            // Check last notification time for this customer and event type
            const [lastNotification] = await databasePool.query<RowDataPacket[]>(`
                SELECT notified_at 
                FROM customer_notification_events 
                WHERE customer_id = ? 
                    AND event_type = ? 
                ORDER BY notified_at DESC 
                LIMIT 1
            `, [customerId, eventType]);

            if (lastNotification.length === 0) {
                // First notification, always send
                return true;
            }

            // Calculate time difference
            const lastNotified = new Date(lastNotification[0].notified_at);
            const timeDiffHours = (Date.now() - lastNotified.getTime()) / (1000 * 60 * 60);

            // Only send if it's been at least 2 hours since the last notification
            return timeDiffHours >= 2;
        } catch (error) {
            console.error('[TwoHourNotification] Error checking notification cooldown:', error);
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
            console.error('[TwoHourNotification] Failed to log notification event:', error);
        }
    }

    /**
     * Check for customers that have come back online and send recovery notifications
     */
    async processRecoveredCustomers(): Promise<void> {
        console.log('[TwoHourNotification] Processing recovered customers...');

        try {
            // Find customers that were offline for 2+ hours but are now online
            const recoveredCustomers = await this.getRecentlyRecoveredCustomers();

            for (const customer of recoveredCustomers) {
                // Get the most recent ticket for this customer
                const [recentTickets] = await databasePool.query<RowDataPacket[]>(`
                    SELECT ticket_number
                    FROM technician_jobs
                    WHERE customer_id = ?
                        AND (title LIKE '%koneksi%' OR title LIKE '%offline%' OR title LIKE '%internet%')
                        AND status IN ('pending', 'accepted', 'in_progress')
                    ORDER BY created_at DESC
                    LIMIT 1
                `, [customer.id]);

                if (recentTickets.length > 0) {
                    // Close the ticket
                    await databasePool.query(`
                        UPDATE technician_jobs 
                        SET status = 'completed', completed_at = NOW(), completion_notes = 'Closed automatically - customer connection recovered'
                        WHERE ticket_number = ?
                    `, [recentTickets[0].ticket_number]);

                    // Send recovery notification
                    await this.sendRecoveryNotification(customer, recentTickets[0].ticket_number);
                }
            }

            console.log(`[TwoHourNotification] Processed ${recoveredCustomers.length} recovered customers`);
        } catch (error) {
            console.error('[TwoHourNotification] Error processing recovered customers:', error);
        }
    }

    /**
     * Find customers that were offline for 2+ hours but are now online
     */
    private async getRecentlyRecoveredCustomers(): Promise<OfflineCustomer[]> {
        try {
            const query = `
                SELECT 
                    c.id,
                    c.name,
                    c.customer_code,
                    c.phone,
                    c.pppoe_username,
                    c.connection_type,
                    cl_offline.timestamp as offline_since
                FROM customers c
                INNER JOIN (
                    -- Get the last offline status for each customer that was offline for 2+ hours
                    SELECT 
                        customer_id,
                        MAX(timestamp) as timestamp
                    FROM connection_logs 
                    WHERE status = 'offline'
                    GROUP BY customer_id
                    HAVING MAX(timestamp) < DATE_SUB(NOW(), INTERVAL 2 HOUR)
                ) cl_offline ON c.id = cl_offline.customer_id
                INNER JOIN (
                    -- Get the last online status after the offline period
                    SELECT 
                        customer_id,
                        MAX(timestamp) as timestamp
                    FROM connection_logs 
                    WHERE status = 'online'
                    GROUP BY customer_id
                ) cl_online ON c.id = cl_online.customer_id
                WHERE 
                    c.status = 'active'
                    AND c.phone IS NOT NULL 
                    AND c.phone != ''
                    AND c.notification_enabled = 1
                    AND c.name NOT LIKE '%nanik%'
                    AND c.name NOT LIKE '%Nanik%'
                    AND c.name NOT LIKE '%NANTIK%'
                    AND c.name NOT LIKE '%nantik%'
                    AND cl_online.timestamp > cl_offline.timestamp  -- Most recent status is online
                    AND NOT EXISTS (
                        -- Ensure there's no more recent offline status after the online one
                        SELECT 1 
                        FROM connection_logs cl_future 
                        WHERE cl_future.customer_id = c.id 
                            AND cl_future.timestamp > cl_online.timestamp
                            AND cl_future.status = 'offline'
                    )
                ORDER BY cl_offline.timestamp DESC
            `;

            const [rows] = await databasePool.query<RowDataPacket[]>(query);

            return rows.map(row => ({
                id: row.id,
                name: row.name,
                customer_code: row.customer_code,
                phone: row.phone,
                pppoe_username: row.pppoe_username,
                connection_type: row.connection_type,
                last_seen_online: new Date(row.offline_since),
                offline_since: new Date(row.offline_since)
            }));
        } catch (error) {
            console.error('[TwoHourNotification] Error getting recently recovered customers:', error);
            return [];
        }
    }
}