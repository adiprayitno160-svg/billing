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
    startDate?: string;
    endDate?: string;
    adminId?: number;
    adminName?: string;
}

export class CompensationService {
    /**
     * Register a new compensation request (Restitution)
     * Handles logic for immediate application to current invoice OR pending for next invoice
     */
    static async registerCompensation(request: CompensationRequest): Promise<void> {
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Get active subscription to calculate daily rate
            const [subscriptionRows] = await connection.query<RowDataPacket[]>(
                `SELECT s.*, c.billing_mode, c.name, c.phone 
                 FROM subscriptions s
                 JOIN customers c ON s.customer_id = c.id
                 WHERE s.customer_id = ? AND s.status = 'active'`,
                [request.customerId]
            );

            let dailyRate = 0;
            let compensationAmount = 0;

            if (subscriptionRows.length > 0) {
                const subscription = subscriptionRows[0];
                dailyRate = parseFloat(subscription.price) / 30;
                compensationAmount = Math.ceil(dailyRate * request.days);
            } else {
                // Fallback: Get last invoice amount
                const [lastInvoice] = await connection.query<RowDataPacket[]>(
                    `SELECT total_amount FROM invoices WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1`,
                    [request.customerId]
                );

                const baseAmount = lastInvoice.length > 0 ? parseFloat(lastInvoice[0].total_amount) : 150000;
                dailyRate = baseAmount / 30;
                compensationAmount = Math.ceil(dailyRate * request.days);
            }

            // 2. Check Date Logic
            const today = new Date();
            const currentDay = today.getDate();
            const currentMonth = today.getMonth() + 1;
            const currentYear = today.getFullYear();
            const currentPeriod = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

            let appliedInvoiceId: number | null = null;
            let status = 'pending';

            // If before 10th, try to apply to CURRENT month's invoice
            if (currentDay <= 10) {
                const [invoiceRows] = await connection.query<RowDataPacket[]>(
                    `SELECT id, total_amount, remaining_amount, status 
                     FROM invoices 
                     WHERE customer_id = ? AND period = ? AND status IN ('sent', 'partial', 'draft')`,
                    [request.customerId, currentPeriod]
                );

                if (invoiceRows.length > 0) {
                    const invoice = invoiceRows[0];
                    appliedInvoiceId = invoice.id;
                    status = 'applied';

                    // Apply directly to invoice
                    await this.applyToInvoice(connection, invoice.id, compensationAmount, request.days, request.reason, request.startDate, request.endDate);
                }
            }

            // 3. Save Record
            await connection.query(
                `INSERT INTO customer_compensations (
                    customer_id, duration_days, start_date, end_date, amount, notes, status, applied_invoice_id, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    request.customerId,
                    request.days,
                    request.startDate || null,
                    request.endDate || null,
                    compensationAmount,
                    request.reason,
                    status,
                    appliedInvoiceId,
                    request.adminId || null
                ]
            );

            await connection.commit();

            // Notify if applied immediately
            // if (status === 'applied') { ... }

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Helper to apply compensation directly to an existing invoice
     */
    private static async applyToInvoice(connection: any, invoiceId: number, amount: number, days: number, reason: string, startDate?: string, endDate?: string): Promise<void> {
        // Format description with dates if available
        let description = `Kompensasi Gangguan (${days} Hari)`;
        if (startDate && endDate) {
            description += ` [${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')}]`;
        }
        description += ` - ${reason}`;

        // Add invoice item (negative value)
        await connection.query(
            `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
             VALUES (?, ?, 1, ?, ?)`,
            [
                invoiceId,
                description,
                -amount,
                -amount
            ]
        );

        // Update Invoice Totals
        // Reduce remaining_amount and total_amount
        await connection.query(
            `UPDATE invoices 
             SET total_amount = total_amount - ?,
                 remaining_amount = GREATEST(0, remaining_amount - ?)
             WHERE id = ?`,
            [amount, amount, invoiceId]
        );

        // Check if fully paid after reduction (if remaining became 0)
        await connection.query(
            `UPDATE invoices 
             SET status = CASE WHEN remaining_amount <= 0 THEN 'paid' ELSE status END
             WHERE id = ?`,
            [invoiceId]
        );
    }

    /**
     * Apply compensation to a customer (Legacy/Balance Credit method)
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
