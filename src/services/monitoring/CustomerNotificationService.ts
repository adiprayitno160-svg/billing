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
     * Broadcast customer status change to Admins & Operators
     */
    async broadcastCustomerStatusToAdmins(
        customer: CustomerInfo,
        status: 'offline' | 'online'
    ): Promise<void> {
        // DISABLED: Admin broadcasts disabled per user request
        console.log(`[Notification] SKIPPED admin broadcast for ${customer.name} status ${status} (Service Disabled)`);
        return;
    }

    /**
     * Broadcast Infrastructure (ODP/ODC) Mass Outage to Admins & Operators
     * Used when multiple customers in the same ODP go offline simultaneously
     */
    async broadcastInfrastructureIssue(
        locationName: string,
        type: 'ODP' | 'ODC',
        status: 'offline' | 'online',
        affectedCount: number
    ): Promise<void> {
        // DISABLED: Infrastructure issue broadcasts disabled per user request
        console.log(`[Notification] SKIPPED infra alert for ${locationName} status ${status} (Service Disabled)`);
        return;
    }
}

export default CustomerNotificationService.getInstance();