/**
 * Prepaid Cleanup Service
 * Handles cleanup and reminder tasks for prepaid payments
 */

import { databasePool } from '../../db/pool';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { WhatsAppServiceBaileys } from '../whatsapp/WhatsAppServiceBaileys';

export class PrepaidCleanupService {
    /**
     * Auto-expire payment requests older than 1 hour
     */
    static async expireOldPaymentRequests(): Promise<void> {
        try {
            const [result] = await databasePool.query<ResultSetHeader>(
                `UPDATE payment_requests 
                SET status = 'expired' 
                WHERE status = 'pending' 
                AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)`
            );

            if (result.affectedRows > 0) {
                console.log(`[PrepaidCleanup] Expired ${result.affectedRows} old payment requests`);
            }
        } catch (error) {
            console.error('[PrepaidCleanup] Error expiring old payment requests:', error);
        }
    }

    /**
     * Send reminder for pending payments (30 minutes after creation)
     */
    static async sendPendingPaymentReminders(): Promise<void> {
        try {
            // Get pending payments created 30 minutes ago, not yet reminded
            const [requests] = await databasePool.query<RowDataPacket[]>(
                `SELECT pr.*, c.name, c.phone, pkg.name as package_name
                FROM payment_requests pr
                JOIN customers c ON pr.customer_id = c.id
                JOIN prepaid_packages pkg ON pr.package_id = pkg.id
                WHERE pr.status = 'pending'
                AND pr.reminder_sent = FALSE
                AND pr.created_at BETWEEN DATE_SUB(NOW(), INTERVAL 35 MINUTE) AND DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
            );

            console.log(`[PrepaidCleanup] Found ${requests.length} pending payments to remind`);

            for (const request of requests) {
                await this.sendPaymentReminder(request);
            }
        } catch (error) {
            console.error('[PrepaidCleanup] Error sending pending payment reminders:', error);
        }
    }

    /**
     * Send payment reminder to customer
     */
    private static async sendPaymentReminder(request: any): Promise<void> {
        try {
            const expiryTime = new Date(request.created_at);
            expiryTime.setHours(expiryTime.getHours() + 1);

            const formattedExpiry = expiryTime.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const message = `⏰ *REMINDER: Menunggu Pembayaran*\n\n` +
                `Halo *${request.name}*,\n\n` +
                `Kami menunggu pembayaran Anda untuk:\n` +
                `📦 Paket: ${request.package_name}\n` +
                `💰 Total: *Rp ${request.total_amount.toLocaleString('id-ID')}*\n` +
                `⚠️ Kode Unik: ${request.unique_code}\n\n` +
                `⏳ Berlaku s/d: ${formattedExpiry} WIB\n\n` +
                `Setelah transfer, kirim bukti foto/screenshot ke nomor ini.\n\n` +
                `_Abaikan pesan ini jika sudah melakukan pembayaran._`;

            const result = await WhatsAppServiceBaileys.sendMessage(request.phone, message);

            // Mark as reminded
            await databasePool.query(
                `UPDATE payment_requests 
                SET reminder_sent = TRUE, reminder_sent_at = NOW() 
                WHERE id = ?`,
                [request.id]
            );

            if (result.success) {
                console.log(`[PrepaidCleanup] Sent reminder to ${request.name} (${request.phone})`);
            } else {
                console.error(`[PrepaidCleanup] Failed to send reminder:`, result.error);
            }
        } catch (error) {
            console.error('[PrepaidCleanup] Error sending payment reminder:', error);
        }
    }

    /**
     * Delete old expired/verified payment requests (> 30 days)
     */
    static async deleteOldPaymentRequests(): Promise<void> {
        try {
            const [result] = await databasePool.query<ResultSetHeader>(
                `DELETE FROM payment_requests 
                WHERE status IN ('expired', 'verified') 
                AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
            );

            if (result.affectedRows > 0) {
                console.log(`[PrepaidCleanup] Deleted ${result.affectedRows} old payment requests`);
            }
        } catch (error) {
            console.error('[PrepaidCleanup] Error deleting old payment requests:', error);
        }
    }

    /**
     * Get cleanup statistics
     */
    static async getCleanupStats(): Promise<{
        pending_count: number;
        expired_count: number;
        verified_count: number;
        old_records_count: number;
    }> {
        try {
            const [stats] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count,
                    SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_count,
                    SUM(CASE WHEN created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as old_records_count
                FROM payment_requests`
            );

            return (stats[0] as any) || {
                pending_count: 0,
                expired_count: 0,
                verified_count: 0,
                old_records_count: 0
            };
        } catch (error) {
            console.error('[PrepaidCleanup] Error getting cleanup stats:', error);
            return {
                pending_count: 0,
                expired_count: 0,
                verified_count: 0,
                old_records_count: 0
            };
        }
    }

    /**
     * Run all cleanup tasks
     */
    static async runAllCleanupTasks(): Promise<void> {
        console.log('[PrepaidCleanup] Starting cleanup tasks...');

        await this.expireOldPaymentRequests();
        await this.sendPendingPaymentReminders();

        // Delete old records once a day (add time check)
        const currentHour = new Date().getHours();
        if (currentHour === 2) { // Run at 2 AM
            await this.deleteOldPaymentRequests();
        }

        console.log('[PrepaidCleanup] Cleanup tasks completed!');
    }
}
