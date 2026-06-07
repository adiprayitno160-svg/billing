"use strict";
/**
 * Customer Notification Service
 * Advanced notification system for customer monitoring events
 * - Timeout/error notifications
 * - Recovery alerts
 * - Escalation policies
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerNotificationService = void 0;
const pool_1 = require("../../db/pool");
const WhatsAppService_1 = require("../whatsapp/WhatsAppService");
class CustomerNotificationService {
    constructor() {
        this.adminBroadcastCooldowns = new Map();
        this.waClient = WhatsAppService_1.whatsappService;
    }
    static getInstance() {
        if (!CustomerNotificationService.instance) {
            CustomerNotificationService.instance = new CustomerNotificationService();
        }
        return CustomerNotificationService.instance;
    }
    /**
     * Send notification for customer trouble event
     */
    async sendTroubleNotification(customer, eventType, details) {
        // DISABLED: Monitoring notifications disabled per user request to reduce spam
        console.log(`[Notification] SKIPPED ${eventType} notification for ${customer.name} (Service Disabled)`);
        return false;
    }
    /**
     * Send AI-Generated Automated Troubleshooting Notification
     */
    async sendAIAutomatedTroubleshooting(customer, eventType) {
        // DISABLED: AI Troubleshooting notifications disabled per user request
        console.log(`[AI-Notification] SKIPPED AI troubleshooting for ${customer.name} (Service Disabled)`);
        return false;
    }
    /**
     * Check if notification should be sent (respect preferences and cooldown)
     */
    async shouldSendNotification(customerId, eventType) {
        try {
            // Check customer notification preferences
            const [prefs] = await pool_1.databasePool.query('SELECT notification_enabled, notification_cooldown_hours FROM customers WHERE id = ?', [customerId]);
            if (prefs.length === 0)
                return true;
            const customerPref = prefs[0];
            // If notifications disabled for customer
            if (customerPref.notification_enabled === 0) {
                return false;
            }
            // Check cooldown period (prevent spam)
            const cooldownHours = customerPref.notification_cooldown_hours || 1;
            const [recentNotifications] = await pool_1.databasePool.query(`SELECT id FROM customer_notification_events 
                 WHERE customer_id = ? AND event_type = ? 
                 AND notified_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
                 ORDER BY notified_at DESC LIMIT 1`, [customerId, eventType, cooldownHours]);
            return recentNotifications.length === 0; // Send if no recent notification
        }
        catch (error) {
            console.error('[Notification] Error checking notification preference:', error);
            return true; // Default to sending if check fails
        }
    }
    /**
     * Log notification event to database
     */
    async logNotificationEvent(event) {
        try {
            await pool_1.databasePool.query(`INSERT INTO customer_notification_events 
                 (customer_id, event_type, severity, message, details, notified_at)
                 VALUES (?, ?, ?, ?, ?, ?)`, [
                event.customer_id,
                event.event_type,
                event.severity,
                event.message,
                event.details ? JSON.stringify(event.details) : null,
                event.notified_at
            ]);
        }
        catch (error) {
            console.error('[Notification] Failed to log notification event:', error);
        }
    }
    /**
     * Get recent notification history for customer
     */
    async getNotificationHistory(customerId, limit = 10) {
        try {
            const [rows] = await pool_1.databasePool.query(`SELECT event_type, severity, notified_at, message
                 FROM customer_notification_events 
                 WHERE customer_id = ?
                 ORDER BY notified_at DESC
                 LIMIT ?`, [customerId, limit]);
            return rows;
        }
        catch (error) {
            console.error('[Notification] Error fetching notification history:', error);
            return [];
        }
    }
    /**
     * Bulk send notifications for multiple customers
     */
    async sendBulkNotifications(customers, eventType, details) {
        let success = 0;
        let failed = 0;
        for (const customer of customers) {
            try {
                const result = await this.sendTroubleNotification(customer, eventType, details);
                if (result) {
                    success++;
                }
                else {
                    failed++;
                }
            }
            catch (error) {
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
    async sendEscalationNotification(eventType, affectedCustomers, details) {
        // DISABLED: Escalation notifications disabled per user request
        console.log(`[Notification] SKIPPED escalation for ${eventType} (${affectedCustomers} affected) (Service Disabled)`);
        return;
    }
    /**
     * Broadcast customer status change to Admins & Operators via Telegram
     */
    async broadcastCustomerStatusToAdmins(customer, status) {
        try {
            // Anti-spam cooldown: 5 minutes per customer per status change
            const cooldownKey = `admin_broadcast_${customer.id}_${status}`;
            const lastSent = this.adminBroadcastCooldowns.get(cooldownKey) || 0;
            const now = Date.now();
            if (now - lastSent < 5 * 60 * 1000) {
                console.log(`[Notification] Cooldown active for ${customer.name} ${status}, skipping Telegram broadcast.`);
                return;
            }
            // Send via Telegram Admin Bot
            const TelegramAdminService = (await Promise.resolve().then(() => __importStar(require('../telegram/TelegramAdminService')))).default;
            const emoji = status === 'offline' ? '🔴' : '🟢';
            const statusText = status === 'offline' ? 'OFFLINE / DOWN' : 'ONLINE / RECOVERED';
            const priority = status === 'offline' ? 'high' : 'medium';
            const connectionInfo = customer.connection_type === 'PPPoE'
                ? `PPPoE: ${customer.pppoe_username || 'N/A'}`
                : `Static IP: ${customer.static_ip || 'N/A'}`;
            const message = `${emoji} *${statusText}*\n\n` +
                `👤 ${customer.name} (ID: ${customer.id})\n` +
                `🔗 ${connectionInfo}\n` +
                `📍 ${customer.address || 'N/A'}\n` +
                `🕐 ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;
            await TelegramAdminService.sendNotification({
                type: status === 'offline' ? 'downtime' : 'custom',
                priority: priority,
                title: `Customer ${statusText}`,
                message,
                targetRole: 'admin',
                customerId: customer.id
            });
            // Update cooldown
            this.adminBroadcastCooldowns.set(cooldownKey, now);
            console.log(`[Notification] Telegram admin broadcast sent for ${customer.name} -> ${status}`);
        }
        catch (error) {
            console.error(`[Notification] Failed to send Telegram admin broadcast for ${customer.name}:`, error);
        }
    }
    /**
     * Broadcast Infrastructure (ODP/ODC) Mass Outage to Admins & Operators
     * Used when multiple customers in the same ODP go offline simultaneously
     */
    async broadcastInfrastructureIssue(locationName, type, status, affectedCount) {
        // DISABLED: Infrastructure issue broadcasts disabled per user request
        console.log(`[Notification] SKIPPED infra alert for ${locationName} status ${status} (Service Disabled)`);
        return;
    }
}
exports.CustomerNotificationService = CustomerNotificationService;
exports.default = CustomerNotificationService.getInstance();
//# sourceMappingURL=CustomerNotificationService.js.map