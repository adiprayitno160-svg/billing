/**
 * Alert Routing Service - Dual Channel Alert System
 * Routes alerts to appropriate channel:
 * - Telegram: Internal staff (admin, teknisi, kasir)
 * - WhatsApp: Customers
 */

import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import telegramBotService from './telegramBotService';
import whatsappService from './billing/whatsappService';

interface Alert {
    alert_type: 'critical' | 'warning' | 'info';
    recipient_type: 'internal' | 'customer';
    recipient_id: number;
    title: string;
    body: string;
    metadata?: any;
}

interface InternalAlert extends Alert {
    recipient_type: 'internal';
    role?: 'admin' | 'teknisi' | 'kasir';
    area?: string;
}

interface CustomerAlert extends Alert {
    recipient_type: 'customer';
    customer_id: number;
}

export class AlertRoutingService {
    
    /**
     * Route alert to appropriate channel
     */
    async routeAlert(alert: Alert): Promise<boolean> {
        try {
            if (alert.recipient_type === 'internal') {
                return await this.sendToTelegram(alert as InternalAlert);
            } else if (alert.recipient_type === 'customer') {
                return await this.sendToWhatsApp(alert as CustomerAlert);
            }
            
            console.warn('[AlertRouting] Unknown recipient type:', alert.recipient_type);
            return false;
            
        } catch (error) {
            console.error('[AlertRouting] Error routing alert:', error);
            return false;
        }
    }
    
    /**
     * Send alert via Telegram (Internal)
     */
    private async sendToTelegram(alert: InternalAlert): Promise<boolean> {
        try {
            // If specific user ID provided, send to that user
            if (alert.recipient_id) {
                const [users] = await pool.query<RowDataPacket[]>(`
                    SELECT telegram_chat_id
                    FROM telegram_users
                    WHERE id = ? AND is_active = 1
                `, [alert.recipient_id]);
                
                if (users.length === 0) {
                    console.warn('[AlertRouting] Telegram user not found:', alert.recipient_id);
                    return false;
                }
                
                const success = await telegramBotService.sendAlert(
                    users[0].telegram_chat_id,
                    {
                        alert_type: alert.alert_type,
                        title: alert.title,
                        body: alert.body,
                        metadata: alert.metadata
                    }
                );
                
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
                const sentCount = await telegramBotService.sendAlertByRole(
                    alert.role,
                    {
                        alert_type: alert.alert_type,
                        title: alert.title,
                        body: alert.body,
                        metadata: alert.metadata
                    },
                    alert.area
                );
                
                console.log(`[AlertRouting] Sent to ${sentCount} Telegram users (role: ${alert.role})`);
                return sentCount > 0;
            }
            
            return false;
            
        } catch (error) {
            console.error('[AlertRouting] Telegram send error:', error);
            return false;
        }
    }
    
    /**
     * Send alert via WhatsApp (Customer)
     */
    private async sendToWhatsApp(alert: CustomerAlert): Promise<boolean> {
        try {
            // Get customer phone number
            const [customers] = await pool.query<RowDataPacket[]>(`
                SELECT phone FROM customers WHERE id = ?
            `, [alert.customer_id]);
            
            if (customers.length === 0 || !customers[0].phone) {
                console.warn('[AlertRouting] Customer phone not found:', alert.customer_id);
                return false;
            }
            
            const phoneNumber = customers[0].phone;
            
            // Format message for WhatsApp (no HTML)
            const message = `*${alert.title}*\n\n${alert.body}`;
            
            // Send via WhatsApp service
            const success = await whatsappService.sendMessage(phoneNumber, message);
            
            await this.logAlert({
                alert_type: alert.alert_type,
                channel: 'whatsapp',
                recipient_type: 'customer',
                recipient_id: alert.customer_id,
                recipient_identifier: phoneNumber,
                message_title: alert.title,
                message_body: alert.body,
                metadata: alert.metadata,
                delivery_status: success ? 'sent' : 'failed'
            });
            
            return success;
            
        } catch (error) {
            console.error('[AlertRouting] WhatsApp send error:', error);
            return false;
        }
    }
    
    /**
     * Log alert to database
     */
    private async logAlert(log: {
        alert_type: 'critical' | 'warning' | 'info';
        channel: 'telegram' | 'whatsapp' | 'email' | 'sms';
        recipient_type: 'internal' | 'customer';
        recipient_id: number;
        recipient_identifier: string;
        message_title: string;
        message_body: string;
        metadata?: any;
        delivery_status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
    }): Promise<void> {
        try {
            await pool.query(`
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
        } catch (error) {
            console.error('[AlertRouting] Failed to log alert:', error);
        }
    }
    
    /**
     * Send downtime alert (to internal staff via Telegram)
     */
    async sendDowntimeAlert(incident: {
        incident_id: number;
        customer_id: number;
        customer_name: string;
        area: string;
        duration_minutes: number;
        service_type: string;
        odc_location?: string;
    }): Promise<void> {
        const alert: InternalAlert = {
            alert_type: 'critical',
            recipient_type: 'internal',
            recipient_id: 0,
            role: 'teknisi',
            area: incident.area,
            title: '🔴 CUSTOMER OFFLINE > 30 MENIT',
            body:
                `━━━━━━━━━━━━━━━━━━━━\n` +
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
        await pool.query(`
            UPDATE sla_incidents
            SET alert_sent_telegram = 1
            WHERE id = ?
        `, [incident.incident_id]);
    }
    
    /**
     * Send service restored notification (to customer via WhatsApp)
     */
    async sendServiceRestoredNotification(customer: {
        customer_id: number;
        customer_name: string;
        downtime_duration: number;
    }): Promise<void> {
        const alert: CustomerAlert = {
            alert_type: 'info',
            recipient_type: 'customer',
            recipient_id: customer.customer_id,
            customer_id: customer.customer_id,
            title: 'Layanan Internet Dipulihkan',
            body:
                `Yth. ${customer.customer_name}\n\n` +
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
    async sendSLABreachNotification(sla: {
        customer_id: number;
        customer_name: string;
        month_year: string;
        sla_percentage: number;
        sla_target: number;
        discount_amount: number;
    }): Promise<void> {
        const alert: CustomerAlert = {
            alert_type: 'info',
            recipient_type: 'customer',
            recipient_id: sla.customer_id,
            customer_id: sla.customer_id,
            title: 'Informasi SLA & Kompensasi',
            body:
                `Yth. ${sla.customer_name}\n\n` +
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
        await pool.query(`
            UPDATE sla_records
            SET notes = CONCAT(COALESCE(notes, ''), '\nWhatsApp notification sent: ', NOW())
            WHERE customer_id = ? AND month_year = ?
        `, [sla.customer_id, sla.month_year]);
    }
    
    /**
     * Send planned maintenance notification (to customers via WhatsApp)
     */
    async sendMaintenanceNotification(maintenance: {
        title: string;
        description: string;
        start_time: Date;
        end_time: Date;
        affected_customers: number[];
    }): Promise<void> {
        const startStr = new Date(maintenance.start_time).toLocaleString('id-ID', {
            dateStyle: 'long',
            timeStyle: 'short'
        });
        
        const endStr = new Date(maintenance.end_time).toLocaleTimeString('id-ID', {
            timeStyle: 'short'
        });
        
        for (const customerId of maintenance.affected_customers) {
            const [customers] = await pool.query<RowDataPacket[]>(`
                SELECT name FROM customers WHERE id = ?
            `, [customerId]);
            
            if (customers.length === 0) continue;
            
            const alert: CustomerAlert = {
                alert_type: 'warning',
                recipient_type: 'customer',
                recipient_id: customerId,
                customer_id: customerId,
                title: '⚠️ Pemberitahuan Maintenance',
                body:
                    `Yth. ${customers[0].name}\n\n` +
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
    async sendSLAWarningToAdmin(warning: {
        customer_name: string;
        current_sla: number;
        target_sla: number;
        estimated_discount: number;
        customer_id: number;
    }): Promise<void> {
        const alert: InternalAlert = {
            alert_type: 'warning',
            recipient_type: 'internal',
            recipient_id: 0,
            role: 'admin',
            title: '🟡 SLA BREACH WARNING',
            body:
                `━━━━━━━━━━━━━━━━━━━━\n` +
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
    async sendDailySummaryReport(): Promise<void> {
        try {
            // Get today's statistics
            const [stats] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(DISTINCT CASE WHEN status = 'ongoing' THEN customer_id END) AS customers_offline,
                    COUNT(CASE WHEN status = 'ongoing' THEN 1 END) AS active_incidents,
                    COUNT(CASE WHEN status = 'resolved' AND DATE(resolved_at) = CURDATE() THEN 1 END) AS resolved_today,
                    AVG(CASE WHEN status = 'resolved' AND DATE(resolved_at) = CURDATE() THEN duration_minutes END) AS avg_resolution_time
                FROM sla_incidents
                WHERE start_time >= DATE_SUB(NOW(), INTERVAL 1 DAY)
            `);
            
            const alert: InternalAlert = {
                alert_type: 'info',
                recipient_type: 'internal',
                recipient_id: 0,
                role: 'admin',
                title: '📊 Daily Summary Report',
                body:
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `📅 ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}\n\n` +
                    `🔴 Customers Offline: ${stats[0].customers_offline}\n` +
                    `🔧 Active Incidents: ${stats[0].active_incidents}\n` +
                    `✅ Resolved Today: ${stats[0].resolved_today}\n` +
                    `⏱️ Avg Resolution: ${Math.round(stats[0].avg_resolution_time || 0)} min\n` +
                    `━━━━━━━━━━━━━━━━━━━━`
            };
            
            await this.routeAlert(alert);
            
        } catch (error) {
            console.error('[AlertRouting] Error sending daily summary:', error);
        }
    }
    
    /**
     * Get alert statistics
     */
    async getAlertStats(days: number = 7): Promise<any> {
        const [stats] = await pool.query<RowDataPacket[]>(`
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

export default new AlertRoutingService();

