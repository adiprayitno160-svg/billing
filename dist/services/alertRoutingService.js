"use strict";
/**
 * Alert Routing Service - Dual Channel Alert System
 * Routes alerts to appropriate channel:
 * - Telegram: Internal staff (admin, teknisi, kasir)
 * - WhatsApp: Customers
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertRoutingService = void 0;
const pool_1 = __importDefault(require("../db/pool"));
const telegramBotService_1 = __importDefault(require("./telegramBotService"));
class AlertRoutingService {
    /**
     * Route alert to appropriate channel
     */
    async routeAlert(alert) {
        try {
            if (alert.recipient_type === 'internal') {
                return await this.sendToTelegram(alert);
            }
            else if (alert.recipient_type === 'customer') {
                // WhatsApp service removed - customer alerts disabled
                console.warn('[AlertRouting] Customer alerts via WhatsApp are disabled');
                return false;
            }
            console.warn('[AlertRouting] Unknown recipient type:', alert.recipient_type);
            return false;
        }
        catch (error) {
            console.error('[AlertRouting] Error routing alert:', error);
            return false;
        }
    }
    /**
     * Send alert via Telegram (Internal)
     */
    async sendToTelegram(alert) {
        try {
            // If specific user ID provided, send to that user
            if (alert.recipient_id) {
                const [users] = await pool_1.default.query(`
                    SELECT telegram_chat_id
                    FROM telegram_users
                    WHERE id = ? AND is_active = 1
                `, [alert.recipient_id]);
                if (users.length === 0) {
                    console.warn('[AlertRouting] Telegram user not found:', alert.recipient_id);
                    return false;
                }
                const success = await telegramBotService_1.default.sendAlert(users[0].telegram_chat_id, {
                    alert_type: alert.alert_type,
                    title: alert.title,
                    body: alert.body,
                    metadata: alert.metadata
                });
                await this.logAlert({
                    alert_type: alert.alert_type,
                    channel: 'telegram',
                    recipient_type: 'internal',
                    recipient_id: alert.recipient_id,
                    recipient_identifier: users[0].telegram_chat_id,
                    message_title: alert.title,
                    message_body: alert.body,
                    metadata: alert.metadata,
                    delivery_status: success ? 'sent' : 'failed'
                });
                return success;
            }
            // Send by role
            if (alert.role) {
                const sentCount = await telegramBotService_1.default.sendAlertByRole(alert.role, {
                    alert_type: alert.alert_type,
                    title: alert.title,
                    body: alert.body,
                    metadata: alert.metadata
                }, alert.area);
                console.log(`[AlertRouting] Sent to ${sentCount} Telegram users (role: ${alert.role})`);
                return sentCount > 0;
            }
            return false;
        }
        catch (error) {
            console.error('[AlertRouting] Telegram send error:', error);
            return false;
        }
    }
    /**
     * Log alert to database
     */
    async logAlert(log) {
        try {
            await pool_1.default.query(`
                INSERT INTO alert_logs (
                    alert_type,
                    channel,
                    recipient_type,
                    recipient_id,
                    recipient_identifier,
                    message_title,
                    message_body,
                    metadata,
                    delivery_status,
                    sent_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                log.alert_type,
                log.channel,
                log.recipient_type,
                log.recipient_id,
                log.recipient_identifier,
                log.message_title,
                log.message_body,
                JSON.stringify(log.metadata || {}),
                log.delivery_status
            ]);
        }
        catch (error) {
            console.error('[AlertRouting] Failed to log alert:', error);
        }
    }
    /**
     * Send downtime alert (to internal staff via Telegram)
     */
    async sendDowntimeAlert(incident) {
        const alert = {
            alert_type: 'critical',
            recipient_type: 'internal',
            recipient_id: 0,
            role: 'teknisi',
            area: incident.area,
            title: '🔴 CUSTOMER OFFLINE > 30 MENIT',
            body: `━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 Customer: ${incident.customer_name}\n` +
                `📍 Area: ${incident.area}\n` +
                `🏢 ODC: ${incident.odc_location || 'N/A'}\n` +
                `⏱️ Duration: ${incident.duration_minutes} menit\n` +
                `🔌 Type: ${incident.service_type.toUpperCase()}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `⚠️ Segera tindak lanjut!`,
            metadata: {
                incident_id: incident.incident_id,
                customer_id: incident.customer_id
            }
        };
        // Send to teknisi in area
        await this.routeAlert(alert);
        // Also send to admin
        await this.routeAlert({
            ...alert,
            role: 'admin',
            area: undefined // Admin gets all alerts
        });
        // Mark alert as sent in incident
        await pool_1.default.query(`
            UPDATE sla_incidents
            SET alert_sent_telegram = 1
            WHERE id = ?
        `, [incident.incident_id]);
    }
    /**
     * Send service restored notification (to customer via WhatsApp)
     */
    async sendServiceRestoredNotification(customer) {
        const alert = {
            alert_type: 'info',
            recipient_type: 'customer',
            recipient_id: customer.customer_id,
            customer_id: customer.customer_id,
            title: 'Layanan Internet Dipulihkan',
            body: `Yth. ${customer.customer_name}\n\n` +
                `Kami informasikan bahwa layanan internet Anda telah dipulihkan.\n\n` +
                `⏱️ Total gangguan: ${customer.downtime_duration} menit\n\n` +
                `Terima kasih atas kesabaran Anda.\n\n` +
                `Tim Support ISP`
        };
        await this.routeAlert(alert);
    }
    /**
     * Send SLA breach notification (to customer via WhatsApp)
     */
    async sendSLABreachNotification(sla) {
        const alert = {
            alert_type: 'info',
            recipient_type: 'customer',
            recipient_id: sla.customer_id,
            customer_id: sla.customer_id,
            title: 'Informasi SLA & Kompensasi',
            body: `Yth. ${sla.customer_name}\n\n` +
                `Kami informasikan performa layanan bulan ${sla.month_year}:\n\n` +
                `📊 SLA Aktual: ${sla.sla_percentage.toFixed(2)}%\n` +
                `🎯 SLA Target: ${sla.sla_target}%\n\n` +
                `Sebagai bentuk komitmen kami, Anda berhak mendapatkan kompensasi:\n` +
                `💰 Potongan: Rp ${sla.discount_amount.toLocaleString('id-ID')}\n\n` +
                `Potongan akan diterapkan pada invoice bulan berikutnya setelah approval.\n\n` +
                `Terima kasih atas kepercayaan Anda.\n\n` +
                `Tim ISP`
        };
        await this.routeAlert(alert);
        // Mark as sent
        await pool_1.default.query(`
            UPDATE sla_records
            SET notes = CONCAT(COALESCE(notes, ''), '\nCustomer notification attempted: ', NOW())
            WHERE customer_id = ? AND month_year = ?
        `, [sla.customer_id, sla.month_year]);
    }
    /**
     * Send planned maintenance notification (to customers via WhatsApp)
     */
    async sendMaintenanceNotification(maintenance) {
        const startStr = new Date(maintenance.start_time).toLocaleString('id-ID', {
            dateStyle: 'long',
            timeStyle: 'short'
        });
        const endStr = new Date(maintenance.end_time).toLocaleTimeString('id-ID', {
            timeStyle: 'short'
        });
        for (const customerId of maintenance.affected_customers) {
            const [customers] = await pool_1.default.query(`
                SELECT name FROM customers WHERE id = ?
            `, [customerId]);
            if (customers.length === 0)
                continue;
            const alert = {
                alert_type: 'warning',
                recipient_type: 'customer',
                recipient_id: customerId,
                customer_id: customerId,
                title: '⚠️ Pemberitahuan Maintenance',
                body: `Yth. ${customers[0].name}\n\n` +
                    `${maintenance.title}\n\n` +
                    `${maintenance.description}\n\n` +
                    `🗓️ Waktu: ${startStr}\n` +
                    `⏰ Selesai (est): ${endStr}\n\n` +
                    `Mohon maaf atas ketidaknyamanan ini.\n\n` +
                    `Tim ISP`
            };
            await this.routeAlert(alert);
        }
    }
    /**
     * Send SLA warning to admin (approaching breach)
     */
    async sendSLAWarningToAdmin(warning) {
        const alert = {
            alert_type: 'warning',
            recipient_type: 'internal',
            recipient_id: 0,
            role: 'admin',
            title: '🟡 SLA BREACH WARNING',
            body: `━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 Customer: ${warning.customer_name}\n` +
                `📊 Current SLA: ${warning.current_sla.toFixed(2)}%\n` +
                `🎯 Target: ${warning.target_sla}%\n` +
                `⚠️ Status: APPROACHING BREACH\n` +
                `💰 Est. Discount: Rp ${warning.estimated_discount.toLocaleString('id-ID')}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Customer ID: ${warning.customer_id}`,
            metadata: {
                customer_id: warning.customer_id
            }
        };
        await this.routeAlert(alert);
    }
    /**
     * Send daily summary report to admin
     */
    async sendDailySummaryReport() {
        try {
            // Get today's statistics
            const [stats] = await pool_1.default.query(`
                SELECT 
                    COUNT(DISTINCT CASE WHEN status = 'ongoing' THEN customer_id END) AS customers_offline,
                    COUNT(CASE WHEN status = 'ongoing' THEN 1 END) AS active_incidents,
                    COUNT(CASE WHEN status = 'resolved' AND DATE(resolved_at) = CURDATE() THEN 1 END) AS resolved_today,
                    AVG(CASE WHEN status = 'resolved' AND DATE(resolved_at) = CURDATE() THEN duration_minutes END) AS avg_resolution_time
                FROM sla_incidents
                WHERE start_time >= DATE_SUB(NOW(), INTERVAL 1 DAY)
            `);
            const alert = {
                alert_type: 'info',
                recipient_type: 'internal',
                recipient_id: 0,
                role: 'admin',
                title: '📊 Daily Summary Report',
                body: `━━━━━━━━━━━━━━━━━━━━\n` +
                    `📅 ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}\n\n` +
                    `🔴 Customers Offline: ${stats[0].customers_offline}\n` +
                    `🔧 Active Incidents: ${stats[0].active_incidents}\n` +
                    `✅ Resolved Today: ${stats[0].resolved_today}\n` +
                    `⏱️ Avg Resolution: ${Math.round(stats[0].avg_resolution_time || 0)} min\n` +
                    `━━━━━━━━━━━━━━━━━━━━`
            };
            await this.routeAlert(alert);
        }
        catch (error) {
            console.error('[AlertRouting] Error sending daily summary:', error);
        }
    }
    /**
     * Get alert statistics
     */
    async getAlertStats(days = 7) {
        const [stats] = await pool_1.default.query(`
            SELECT 
                channel,
                alert_type,
                COUNT(*) AS total_alerts,
                SUM(CASE WHEN delivery_status = 'sent' THEN 1 ELSE 0 END) AS successful,
                SUM(CASE WHEN delivery_status = 'failed' THEN 1 ELSE 0 END) AS failed
            FROM alert_logs
            WHERE sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY channel, alert_type
            ORDER BY channel, alert_type
        `, [days]);
        return stats;
    }
}
exports.AlertRoutingService = AlertRoutingService;
exports.default = new AlertRoutingService();
//# sourceMappingURL=alertRoutingService.js.map