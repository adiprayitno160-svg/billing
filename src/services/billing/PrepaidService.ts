/**
 * Prepaid Billing Service
 */

import { databasePool } from '../../db/pool';
import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { whatsappService } from '../whatsappService';

export class PrepaidService {
    /**
     * Switch customer to prepaid mode
     */
    static async switchToPrepaid(customerId: number, existingConnection?: PoolConnection | Pool): Promise<void> {
        const connection = existingConnection || await databasePool.getConnection();
        const isNewConnection = !existingConnection;

        try {
            if (isNewConnection) await (connection as PoolConnection).beginTransaction();

            // 1. Update customer billing mode
            await connection.execute(
                "UPDATE customers SET billing_mode = 'prepaid', updated_at = NOW() WHERE id = ?",
                [customerId]
            );

            // 2. Clear any active subscriptions if any (prepaid manages balance differently)
            // Or keep them but mark as prepaid? 
            // In our system, subscription.price is used to deduct from balance daily or monthly.

            if (isNewConnection) await (connection as PoolConnection).commit();

            // 3. Send notification
            const [customerRows] = await connection.query<RowDataPacket[]>(
                "SELECT name, phone FROM customers WHERE id = ?",
                [customerId]
            );

            if (customerRows.length > 0 && customerRows[0].phone) {
                const customer = customerRows[0];
                const message = `Halo ${customer.name}, akun Anda telah dialihkan ke metode pembayaran *Prepaid (Saldo)*. \n\nPastikan saldo Anda mencukupi agar layanan tetap aktif. Anda dapat melakukan top-up melalui aplikasi atau agen terdekat.`;

                await whatsappService.sendMessage(customer.phone, message).catch(err => {
                    console.error('[PrepaidService] Failed to send WhatsApp notification:', err);
                });
            }

        } catch (error) {
            if (isNewConnection) await (connection as PoolConnection).rollback();
            throw error;
        } finally {
            if (isNewConnection) connection.release();
        }
    }

    /**
     * Top up customer balance
     */
    static async topUpBalance(customerId: number, amount: number, method: string, notes?: string, adminId?: number, existingConnection?: PoolConnection | Pool): Promise<number> {
        const connection = existingConnection || await databasePool.getConnection();
        const isNewConnection = !existingConnection;

        try {
            if (isNewConnection) await (connection as PoolConnection).beginTransaction();

            // 1. Add balance
            await connection.execute(
                "UPDATE customers SET balance = balance + ? WHERE id = ?",
                [amount, customerId]
            );

            // 2. Log transaction
            const [result] = await connection.execute<ResultSetHeader>(
                `INSERT INTO customer_balance_logs (customer_id, type, amount, description, created_by, created_at)
                 VALUES (?, 'topup', ?, ?, ?, NOW())`,
                [customerId, amount, notes || `Topup via ${method}`, adminId || 0]
            );

            if (isNewConnection) await (connection as PoolConnection).commit();
            return result.insertId;

        } catch (error) {
            if (isNewConnection) await (connection as PoolConnection).rollback();
            throw error;
        } finally {
            if (isNewConnection) connection.release();
        }
    }
}
