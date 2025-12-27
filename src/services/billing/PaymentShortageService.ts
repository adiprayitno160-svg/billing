/**
 * Payment Shortage Service
 * Handles notifications for customers with partial payments or overdue payments
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { UnifiedNotificationService } from '../notification/UnifiedNotificationService';

export class PaymentShortageService {
    /**
     * Check and send notifications for payment shortages
     * @param daysThreshold Number of days after due date to send warning (default: 14 days = 2 weeks)
     */
    static async checkAndNotifyShortages(daysThreshold: number = 14): Promise<{
        checked: number;
        notified: number;
        failed: number;
    }> {
        const connection = await databasePool.getConnection();
        let checked = 0;
        let notified = 0;
        let failed = 0;

        try {
            // Get invoices with partial payment or overdue that haven't been notified recently
            const query = `
                SELECT DISTINCT
                    i.id as invoice_id,
                    i.invoice_number,
                    i.customer_id,
                    i.total_amount,
                    i.paid_amount,
                    i.remaining_amount,
                    i.due_date,
                    i.status,
                    c.name as customer_name,
                    c.phone,
                    c.customer_code,
                    DATEDIFF(CURDATE(), i.due_date) as days_overdue
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.status IN ('partial', 'overdue', 'sent')
                AND i.remaining_amount > 0
                AND c.status = 'active'
                AND c.is_isolated = FALSE
                AND c.phone IS NOT NULL
                AND c.phone != ''
                AND DATEDIFF(CURDATE(), i.due_date) >= ?
                AND NOT EXISTS (
                    SELECT 1 FROM notification_queue nq
                    WHERE nq.customer_id = c.id
                    AND nq.invoice_id = i.id
                    AND nq.notification_type = 'payment_shortage_warning'
                    AND DATE(nq.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                )
            `;

            const [invoices] = await connection.query<RowDataPacket[]>(query, [daysThreshold]);

            console.log(`[PaymentShortageService] Found ${invoices.length} invoices with payment shortage (>= ${daysThreshold} days)`);

            checked = invoices.length;

            for (const invoice of invoices) {
                try {
                    if (!invoice.phone) {
                        console.log(`[PaymentShortageService] ⚠️ No phone number for customer ${invoice.customer_name}, skipping`);
                        continue;
                    }

                    const daysOverdue = invoice.days_overdue || 0;

                    console.log(`[PaymentShortageService] 📱 Sending shortage warning to customer ${invoice.customer_name} (${daysOverdue} days overdue)...`);

                    const notificationIds = await UnifiedNotificationService.queueNotification({
                        customer_id: invoice.customer_id,
                        invoice_id: invoice.invoice_id,
                        notification_type: 'payment_shortage_warning',
                        channels: ['whatsapp'],
                        variables: {
                            customer_name: invoice.customer_name || 'Pelanggan',
                            invoice_number: invoice.invoice_number || '',
                            total_amount: parseFloat(invoice.total_amount || 0).toLocaleString('id-ID'),
                            paid_amount: parseFloat(invoice.paid_amount || 0).toLocaleString('id-ID'),
                            remaining_amount: parseFloat(invoice.remaining_amount || 0).toLocaleString('id-ID'),
                            due_date: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('id-ID') : '-',
                            days_overdue: daysOverdue.toString()
                        },
                        priority: 'high'
                    });

                    console.log(`[PaymentShortageService] ✅ Shortage warning queued (IDs: ${notificationIds.join(', ')})`);

                    // Process queue immediately
                    try {
                        const result = await UnifiedNotificationService.sendPendingNotifications(10);
                        console.log(`[PaymentShortageService] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed`);
                    } catch (queueError: any) {
                        console.warn(`[PaymentShortageService] ⚠️ Queue processing error (non-critical):`, queueError.message);
                    }

                    notified++;

                } catch (error: any) {
                    console.error(`[PaymentShortageService] Failed to send warning to customer ${invoice.customer_id}:`, error.message);
                    failed++;
                }
            }

        } catch (error) {
            console.error('[PaymentShortageService] Error checking shortages:', error);
            throw error;
        } finally {
            connection.release();
        }

        return { checked, notified, failed };
    }
}


