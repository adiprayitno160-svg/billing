import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { UnifiedNotificationService } from '../notification/UnifiedNotificationService';

export interface DefermentRequest {
    customer_id: number;
    invoice_id?: number;
    deferred_until_date: string; // YYYY-MM-DD
    reason: string;
    requested_by?: string;
}

export class DefermentService {
    /**
     * Check how many deferments a customer had this year
     */
    static async getDefermentCountThisYear(customerId: number): Promise<number> {
        const currentYear = new Date().getFullYear();
        const [rows] = await databasePool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as count FROM payment_deferments 
             WHERE customer_id = ? AND YEAR(created_at) = ? AND status != 'rejected'`,
            [customerId, currentYear]
        );
        return rows[0]?.count || 0;
    }

    /**
     * Request a payment deferment
     */
    static async requestDeferment(data: DefermentRequest): Promise<{ success: boolean; message: string }> {
        const count = await this.getDefermentCountThisYear(data.customer_id);

        if (count >= 4) {
            // Send failure notification
            await this.sendDefermentLimitReachedNotification(data.customer_id);
            return { success: false, message: 'Limit penundaan (4x setahun) sudah tercapai.' };
        }

        const connection = await databasePool.getConnection();
        try {
            await connection.beginTransaction();

            // Insert deferment record
            await connection.query<ResultSetHeader>(
                `INSERT INTO payment_deferments (customer_id, invoice_id, requested_date, deferred_until_date, reason, status, count_in_year)
                 VALUES (?, ?, CURDATE(), ?, ?, 'approved', ?)`,
                [data.customer_id, data.invoice_id || null, data.deferred_until_date, data.reason, count + 1]
            );

            // Update customer status
            await connection.query(
                'UPDATE customers SET is_deferred = TRUE WHERE id = ?',
                [data.customer_id]
            );

            await connection.commit();

            // Send success notification
            await this.sendDefermentapprovedNotification(data.customer_id, data.deferred_until_date);

            return { success: true, message: 'Penundaan pembayaran berhasil disetujui.' };
        } catch (error) {
            await connection.rollback();
            console.error('Deferment request error:', error);
            return { success: false, message: 'Gagal memproses penundaan.' };
        } finally {
            connection.release();
        }
    }

    /**
     * Check and process expired deferments
     * Should be called periodically (CRON)
     * Rule: If deferred until date is passed, block on the night of (deferred + 1)
     * e.g. Deferred until 6th, if no payment, block on 7th night.
     */
    static async processExpiredDeferments(): Promise<{ processed: number }> {
        // Find deferments where deferred_until_date < CURDATE() and status is approved
        // In this case, if today is 7th and deferred was 6th.
        const [rows] = await databasePool.query<RowDataPacket[]>(
            `SELECT d.*, c.name, c.phone 
             FROM payment_deferments d
             JOIN customers c ON d.customer_id = c.id
             WHERE d.status = 'approved' AND d.deferred_until_date < CURDATE()`
        );

        let processed = 0;
        for (const row of rows) {
            const connection = await databasePool.getConnection();
            try {
                await connection.beginTransaction();

                // Update deferment status to completed (meaning the time is up)
                await connection.query(
                    'UPDATE payment_deferments SET status = "completed" WHERE id = ?',
                    [row.id]
                );

                // Reset customer deferred status
                await connection.query(
                    'UPDATE customers SET is_deferred = FALSE WHERE id = ?',
                    [row.customer_id]
                );

                await connection.commit();

                // Actually isolate the customer now
                const { IsolationService } = await import('./isolationService');
                await IsolationService.isolateCustomer({
                    customer_id: row.customer_id,
                    action: 'isolate',
                    reason: `Penundaan pembayaran berakhir (sampai tanggal ${new Date(row.deferred_until_date).toLocaleDateString('id-ID')}) dan belum ada pelunasan.`
                });

                processed++;
            } catch (error) {
                await connection.rollback();
                console.error(`Failed to process expired deferment for customer ${row.customer_id}:`, error);
            } finally {
                connection.release();
            }
        }

        return { processed };
    }

    private static async sendDefermentapprovedNotification(customerId: number, untilDate: string) {
        // Fetch customer details
        const [rows] = await databasePool.query<RowDataPacket[]>(
            'SELECT name, customer_code FROM customers WHERE id = ?',
            [customerId]
        );
        const customer = rows[0];

        if (customer) {
            await UnifiedNotificationService.queueNotification({
                customer_id: customerId,
                notification_type: 'payment_deferment',
                channels: ['whatsapp'],
                variables: {
                    details: `Batas waktu penundaan: ${new Date(untilDate).toLocaleDateString('id-ID')}.`
                },
                priority: 'normal'
            });
        }
    }

    private static async sendDefermentLimitReachedNotification(customerId: number) {
        const [rows] = await databasePool.query<RowDataPacket[]>(
            'SELECT name FROM customers WHERE id = ?',
            [customerId]
        );
        const customer = rows[0];

        if (customer) {
            await UnifiedNotificationService.queueNotification({
                customer_id: customerId,
                notification_type: 'payment_deferment',
                channels: ['whatsapp'],
                variables: {
                    details: `Limit penundaan (4x dalam 1 tahun) sudah tercapai.`
                },
                priority: 'high'
            });
        }
    }
}
