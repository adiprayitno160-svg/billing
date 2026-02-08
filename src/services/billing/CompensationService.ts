/**
 * Compensation Service
 * Handles compensation logic for service interruptions (gangguan)
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { UnifiedNotificationService } from '../notification/UnifiedNotificationService';

export interface CompensationRequest {
    customerId: number;
    days: number; // Number of days to compensate
    reason: string;
    adminId?: number;
    adminName?: string;
}

export class CompensationService {
    /**
     * Apply compensation to a customer
     * This extends the current subscription period or adds a credit/discount to the next invoice
     */
    static async applyCompensation(request: CompensationRequest): Promise<void> {
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Get active subscription
            const [subscriptionRows] = await connection.query<RowDataPacket[]>(
                `SELECT s.*, c.name, c.phone, c.billing_mode 
                 FROM subscriptions s
                 JOIN customers c ON s.customer_id = c.id
                 WHERE s.customer_id = ? AND s.status = 'active'`,
                [request.customerId]
            );

            if (subscriptionRows.length === 0) {
                // If no active subscription (e.g., static IP or just customer record), 
                // we can add balance credit instead
                await this.applyBalanceCredit(connection, request);
            } else {
                const subscription = subscriptionRows[0];

                // Option A: Extend the due date of the current UNPAID invoice if exists
                // Option B: Add a discount record for the NEXT invoice generation

                // Let's implement Option B: Create a 'service_interruption' record that is checked during invoice generation
                // OR directly update invoice if generated.

                // Simplified Approach for Billing System:
                // 1. Calculate value of compensation (Price / 30 * days)
                // 2. Add as 'credit' to customer balance
                // 3. Next invoice will use this credit

                const dailyRate = parseFloat(subscription.price) / 30;
                const compensationAmount = Math.ceil(dailyRate * request.days);

                // Add to customer balance
                await connection.query(
                    `UPDATE customers SET balance = balance + ? WHERE id = ?`,
                    [compensationAmount, request.customerId]
                );

                // Log transaction
                await connection.query(
                    `INSERT INTO customer_balance_logs (customer_id, type, amount, description, created_by, created_at)
                    VALUES (?, 'credit', ?, ?, ?, NOW())`,
                    [
                        request.customerId,
                        compensationAmount,
                        `Kompensasi Gangguan: ${request.days} hari. ${request.reason}`,
                        request.adminName || 'System'
                    ]
                );

                console.log(`✅ Applied compensation: ${request.days} days (Rp ${compensationAmount}) for customer ${request.customerId}`);

                // Send Notification
                if (subscription.phone) {
                    await UnifiedNotificationService.queueNotification({
                        customer_id: request.customerId,
                        notification_type: 'broadcast', // Reuse broadcast or specific type
                        channels: ['whatsapp'],
                        variables: {
                            customer_name: subscription.name,
                            custom_message: `Mohon maaf atas gangguan layanan Anda. \n\nKami telah menambahkan kompensasi sebesar *Rp ${compensationAmount.toLocaleString('id-ID')}* (${request.days} hari) ke saldo akun Anda. Potongan ini akan otomatis digunakan pada tagihan berikutnya.\n\nTerima kasih atas pengertiannya.`
                        },
                        priority: 'high'
                    });
                }
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Apply balance credit (fallback)
     */
    private static async applyBalanceCredit(connection: any, request: CompensationRequest): Promise<void> {
        // Estimate average package price (e.g., 150k) if no sub found, or just skip
        // Better: Get last invoice amount
        const [lastInvoice] = await connection.query(
            `SELECT total_amount FROM invoices WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1`,
            [request.customerId]
        );

        let baseAmount = 150000; // Default fallback
        if (lastInvoice.length > 0) {
            baseAmount = parseFloat(lastInvoice[0].total_amount);
        }

        const dailyRate = baseAmount / 30;
        const compensationAmount = Math.ceil(dailyRate * request.days);

        await connection.query(
            `UPDATE customers SET balance = balance + ? WHERE id = ?`,
            [compensationAmount, request.customerId]
        );

        await connection.query(
            `INSERT INTO customer_balance_logs (customer_id, type, amount, description, created_by, created_at)
            VALUES (?, 'credit', ?, ?, ?, NOW())`,
            [
                request.customerId,
                compensationAmount,
                `Kompensasi Gangguan (Non-Active Sub): ${request.days} hari. ${request.reason}`,
                request.adminName || 'System'
            ]
        );
    }

    /**
     * Bulk apply compensation for reported trouble reporting
     */
    static async processBulkCompensation(incidentId: number, adminId: number): Promise<void> {
        // Implementation for future: compensating all users affected by a specific network incident
    }
}
