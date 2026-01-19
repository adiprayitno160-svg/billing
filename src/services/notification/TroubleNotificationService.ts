/**
 * Trouble Notification Service
 * Sends notifications to admin/operator when customer has issues/errors
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { WhatsAppClient } from '../whatsapp';

export interface TroubleReport {
    customer_id: number;
    customer_name: string;
    customer_phone?: string;
    trouble_type: 'connection_down' | 'payment_issue' | 'equipment_failure' | 'complaint' | 'other';
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    reported_by?: string; // 'system', 'customer', 'technician'
    additional_info?: string;
}

export interface AdminOperator {
    id: number;
    username: string;
    full_name: string;
    phone: string;
    role: 'superadmin' | 'operator' | 'admin';
}

export class TroubleNotificationService {

    /**
     * Get all admin and operator users with phone numbers
     */
    static async getAdminOperators(): Promise<AdminOperator[]> {
        const connection = await databasePool.getConnection();

        try {
            const [users] = await connection.query<RowDataPacket[]>(
                `SELECT id, username, full_name, phone, role 
                 FROM users 
                 WHERE role IN ('superadmin', 'operator', 'admin') 
                   AND is_active = 1 
                   AND phone IS NOT NULL 
                   AND phone != ''
                 ORDER BY 
                   CASE role 
                     WHEN 'superadmin' THEN 1 
                     WHEN 'admin' THEN 2 
                     WHEN 'operator' THEN 3 
                   END`
            );

            return users as AdminOperator[];
        } finally {
            connection.release();
        }
    }

    /**
     * Format phone number for WhatsApp
     */
    private static formatPhoneNumber(phone: string): string {
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');

        // If starts with 0, replace with 62 (Indonesia)
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }

        // If doesn't start with country code, add 62
        if (!cleaned.startsWith('62')) {
            cleaned = '62' + cleaned;
        }

        return cleaned;
    }

    /**
     * Build trouble notification message
     */
    private static buildTroubleMessage(report: TroubleReport): string {
        const priorityEmoji = {
            'low': '🟢',
            'medium': '🟡',
            'high': '🟠',
            'critical': '🔴'
        };

        const troubleTypeLabel = {
            'connection_down': 'Koneksi Terputus',
            'payment_issue': 'Masalah Pembayaran',
            'equipment_failure': 'Kerusakan Perangkat',
            'complaint': 'Komplain Pelanggan',
            'other': 'Lainnya'
        };

        const reportedByLabel = {
            'system': 'Sistem Otomatis',
            'customer': 'Pelanggan',
            'technician': 'Teknisi'
        };

        const timestamp = new Date().toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let message = `${priorityEmoji[report.priority]} *LAPORAN GANGGUAN*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `📋 *Jenis Gangguan:* ${troubleTypeLabel[report.trouble_type]}\n`;
        message += `⚡ *Prioritas:* ${report.priority.toUpperCase()}\n\n`;
        message += `👤 *Pelanggan:* ${report.customer_name}\n`;

        if (report.customer_phone) {
            message += `📞 *Telepon:* ${report.customer_phone}\n`;
        }

        message += `🆔 *ID:* ${report.customer_id}\n\n`;
        message += `📝 *Deskripsi:*\n${report.description}\n`;

        if (report.additional_info) {
            message += `\nℹ️ *Info Tambahan:*\n${report.additional_info}\n`;
        }

        message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `🕐 ${timestamp}\n`;
        message += `📤 Dilaporkan oleh: ${report.reported_by ? reportedByLabel[report.reported_by] || report.reported_by : 'Sistem'}`;

        return message;
    }

    /**
     * Send trouble notification to all admin/operators
     */
    static async notifyTrouble(report: TroubleReport): Promise<{
        success: boolean;
        sent_to: string[];
        failed: string[];
        message: string;
    }> {
        const sent_to: string[] = [];
        const failed: string[] = [];

        try {
            // Get all admin/operators with phone numbers
            const adminOperators = await this.getAdminOperators();

            if (adminOperators.length === 0) {
                console.warn('[TroubleNotification] No admin/operator with phone numbers found');
                return {
                    success: false,
                    sent_to: [],
                    failed: [],
                    message: 'Tidak ada admin/operator dengan nomor telepon terdaftar'
                };
            }

            console.log(`[TroubleNotification] Sending to ${adminOperators.length} admin/operators...`);

            // Build message
            const message = this.buildTroubleMessage(report);

            // Check WhatsApp status
            const waClient = WhatsAppClient.getInstance();
            const waStatus = waClient.getStatus();
            if (!waStatus.ready) {
                console.error('[TroubleNotification] WhatsApp not ready');
                return {
                    success: false,
                    sent_to: [],
                    failed: adminOperators.map(u => u.full_name),
                    message: 'WhatsApp tidak terhubung'
                };
            }

            // Send to each admin/operator
            for (const user of adminOperators) {
                try {
                    const formattedPhone = this.formatPhoneNumber(user.phone);

                    await WhatsAppClient.sendMessage(formattedPhone, message);

                    sent_to.push(user.full_name);
                    console.log(`[TroubleNotification] ✅ Sent to ${user.full_name} (${user.role})`);

                    // Small delay between messages to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (sendError: any) {
                    failed.push(user.full_name);
                    console.error(`[TroubleNotification] ❌ Failed to send to ${user.full_name}:`, sendError.message);
                }
            }

            // Log to database
            await this.logTroubleNotification(report, sent_to, failed);

            return {
                success: sent_to.length > 0,
                sent_to,
                failed,
                message: `Terkirim ke ${sent_to.length} dari ${adminOperators.length} admin/operator`
            };

        } catch (error: any) {
            console.error('[TroubleNotification] Error:', error);
            return {
                success: false,
                sent_to: [],
                failed: [],
                message: error.message || 'Gagal mengirim notifikasi'
            };
        }
    }

    /**
     * Log trouble notification to database
     */
    private static async logTroubleNotification(
        report: TroubleReport,
        sent_to: string[],
        failed: string[]
    ): Promise<void> {
        const connection = await databasePool.getConnection();

        try {
            // Check if trouble_notifications table exists
            const [tables] = await connection.query<RowDataPacket[]>(
                `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trouble_notifications'`
            );

            if (tables.length === 0) {
                // Create table if not exists
                await connection.query(`
                    CREATE TABLE trouble_notifications (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        customer_id INT NOT NULL,
                        customer_name VARCHAR(255) NOT NULL,
                        trouble_type VARCHAR(50) NOT NULL,
                        description TEXT,
                        priority VARCHAR(20) NOT NULL,
                        reported_by VARCHAR(50),
                        sent_to TEXT,
                        failed TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_customer_id (customer_id),
                        INDEX idx_created_at (created_at),
                        INDEX idx_trouble_type (trouble_type)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);
                console.log('[TroubleNotification] Created trouble_notifications table');
            }

            // Insert log
            await connection.query(
                `INSERT INTO trouble_notifications 
                 (customer_id, customer_name, trouble_type, description, priority, reported_by, sent_to, failed)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    report.customer_id,
                    report.customer_name,
                    report.trouble_type,
                    report.description,
                    report.priority,
                    report.reported_by || 'system',
                    sent_to.join(', '),
                    failed.join(', ')
                ]
            );

        } catch (error) {
            console.error('[TroubleNotification] Error logging to database:', error);
            // Don't throw - logging failure shouldn't break notification
        } finally {
            connection.release();
        }
    }

    /**
     * Quick method to report connection down
     */
    static async reportConnectionDown(
        customerId: number,
        customerName: string,
        customerPhone?: string,
        details?: string
    ): Promise<any> {
        return this.notifyTrouble({
            customer_id: customerId,
            customer_name: customerName,
            customer_phone: customerPhone,
            trouble_type: 'connection_down',
            description: details || `Koneksi pelanggan ${customerName} terdeteksi terputus`,
            priority: 'high',
            reported_by: 'system'
        });
    }

    /**
     * Quick method to report equipment failure
     */
    static async reportEquipmentFailure(
        customerId: number,
        customerName: string,
        customerPhone?: string,
        equipmentInfo?: string
    ): Promise<any> {
        return this.notifyTrouble({
            customer_id: customerId,
            customer_name: customerName,
            customer_phone: customerPhone,
            trouble_type: 'equipment_failure',
            description: equipmentInfo || `Kerusakan perangkat terdeteksi untuk pelanggan ${customerName}`,
            priority: 'high',
            reported_by: 'system'
        });
    }

    /**
     * Quick method to report customer complaint
     */
    static async reportComplaint(
        customerId: number,
        customerName: string,
        complaintDetails: string,
        customerPhone?: string,
        priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
    ): Promise<any> {
        return this.notifyTrouble({
            customer_id: customerId,
            customer_name: customerName,
            customer_phone: customerPhone,
            trouble_type: 'complaint',
            description: complaintDetails,
            priority,
            reported_by: 'customer'
        });
    }
}
