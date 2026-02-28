/**
 * Prepaid Billing Service
 */

import { databasePool } from '../../db/pool';
import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { whatsappService } from '../whatsapp/WhatsAppService';

export class PrepaidService {
    /**
     * Switch customer to prepaid mode
     */
    static async switchToPrepaid(customerId: number, initialDays: number = 1, sendNotification: boolean = true): Promise<any> {
        const connection = await databasePool.getConnection();
        try {
            await connection.beginTransaction();

            // Get customer info
            const [customers] = await connection.query<RowDataPacket[]>(
                'SELECT id, name, phone, billing_mode, pppoe_profile_id FROM customers WHERE id = ?',
                [customerId]
            );

            if (!customers || customers.length === 0) {
                throw new Error('Customer not found');
            }

            const customer = customers[0];

            // Check if already prepaid
            if (customer.billing_mode === 'prepaid') {
                await connection.rollback();
                return { success: false, message: 'Customer already in prepaid mode' };
            }

            // Calculate expiry date
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + initialDays);

            // Update customer
            await connection.query(
                "UPDATE customers SET billing_mode = 'prepaid', expiry_date = ?, is_isolated = 0 WHERE id = ?",
                [expiryDate, customerId]
            );

            // Get package name for notification
            let packageName = 'Paket Internet';
            if (customer.pppoe_profile_id) {
                const [profiles]: any = await connection.query('SELECT name FROM pppoe_profiles WHERE id = ?', [customer.pppoe_profile_id]);
                if (profiles && profiles.length > 0) packageName = profiles[0].name;
            }

            await connection.commit();

            if (sendNotification && customer.phone) {
                const message = `Halo ${customer.name}, akun Anda telah dialihkan ke metode pembayaran *Prepaid (Saldo)*. \n\nSisa Masa Aktif: ${initialDays} hari.\nExpires: ${expiryDate.toLocaleString('id-ID')}`;
                await whatsappService.sendMessage(customer.phone, message).catch(err => console.error(err));
            }

            return { success: true, message: 'Switched to prepaid', expiryDate };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Switch customer back to postpaid mode
     */
    static async switchToPostpaid(customerId: number): Promise<any> {
        const connection = await databasePool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query("UPDATE customers SET billing_mode = 'postpaid', expiry_date = NULL WHERE id = ?", [customerId]);
            await connection.commit();
            return { success: true, message: 'Switched to postpaid' };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Generate payment request
     */
    static async generatePaymentRequest(customerId: number, packageId: number, durationDays: number, options: any = {}): Promise<any> {
        const connection = await databasePool.getConnection();
        try {
            await connection.beginTransaction();

            const [packages]: any = await connection.query(
                `SELECT id, name, 
                 CASE 
                     WHEN ? = 7 THEN price_7_days
                     WHEN ? = 14 THEN price_14_days
                     WHEN ? = 30 THEN price_30_days
                     ELSE price
                 END as price
                 FROM pppoe_packages WHERE id = ?`,
                [durationDays, durationDays, durationDays, packageId]
            );

            if (!packages || packages.length === 0) throw new Error('Package not found');
            const pkg = packages[0];
            const baseAmount = parseFloat(pkg.price || '0');

            const uniqueCode = Math.floor(Math.random() * 900) + 100;
            const finalTotal = baseAmount + uniqueCode;

            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1);

            const [result]: any = await connection.query(
                `INSERT INTO payment_requests (customer_id, package_id, duration_days, base_amount, unique_code, total_amount, expires_at, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [customerId, packageId, durationDays, baseAmount, uniqueCode, finalTotal, expiresAt]
            );

            await connection.commit();

            const [created]: any = await connection.query('SELECT * FROM payment_requests WHERE id = ?', [result.insertId]);
            return { success: true, paymentRequest: created[0] };
        } catch (error: any) {
            await connection.rollback();
            return { success: false, message: error.message };
        } finally {
            connection.release();
        }
    }

    /**
     * Confirm payment
     */
    static async confirmPayment(paymentRequestId: number, verifiedBy: number | null = null, paymentMethod: string = 'transfer'): Promise<any> {
        const connection = await databasePool.getConnection();
        try {
            await connection.beginTransaction();

            const [requests]: any = await connection.query(
                'SELECT pr.*, c.expiry_date as current_expiry FROM payment_requests pr JOIN customers c ON pr.customer_id = c.id WHERE pr.id = ?',
                [paymentRequestId]
            );

            if (!requests || requests.length === 0) throw new Error('Payment request not found');
            const request = requests[0];

            // Prevent double-confirm
            if (request.status === 'paid') {
                await connection.rollback();
                return { success: false, message: 'Payment request already confirmed' };
            }

            const baseDate = request.current_expiry && new Date(request.current_expiry) > new Date()
                ? new Date(request.current_expiry)
                : new Date();

            const newExpiryDate = new Date(baseDate);
            newExpiryDate.setDate(newExpiryDate.getDate() + request.duration_days);

            // 1. Mark payment request as paid
            await connection.query("UPDATE payment_requests SET status = 'paid', paid_at = NOW() WHERE id = ?", [paymentRequestId]);

            // 2. Extend customer expiry & remove isolation
            await connection.query("UPDATE customers SET expiry_date = ?, is_isolated = 0 WHERE id = ?", [newExpiryDate, request.customer_id]);

            // 3. Record in prepaid_transactions for dashboard & reporting
            try {
                await connection.query(
                    `INSERT INTO prepaid_transactions 
                     (customer_id, package_id, amount, duration_days, payment_method, 
                      previous_expiry_date, new_expiry_date, verified_by, payment_request_id, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        request.customer_id,
                        request.package_id,
                        parseFloat(request.total_amount),
                        request.duration_days,
                        paymentMethod,
                        request.current_expiry || null,
                        newExpiryDate,
                        verifiedBy,
                        paymentRequestId
                    ]
                );
                console.log(`[PrepaidService] ✅ Transaction recorded for customer ${request.customer_id}`);
            } catch (txErr: any) {
                // Log but don't fail – table might not have all columns yet
                console.error(`[PrepaidService] ⚠️ Failed to record prepaid_transaction (non-fatal):`, txErr.message);
            }

            await connection.commit();
            return { success: true, message: 'Payment confirmed', newExpiryDate };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Top up customer balance
     */
    static async topUpBalance(customerId: number, amount: number, method: string, notes?: string, adminId?: number): Promise<number> {
        const connection = await databasePool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute("UPDATE customers SET balance = balance + ? WHERE id = ?", [amount, customerId]);
            const [result]: any = await connection.execute(
                "INSERT INTO customer_balance_logs (customer_id, type, amount, description, created_by, created_at) VALUES (?, 'topup', ?, ?, ?, NOW())",
                [customerId, amount, notes || `Topup via ${method}`, adminId || 0]
            );
            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get expired prepaid customers
     */
    static async getExpiredCustomers(): Promise<any[]> {
        const [rows] = await databasePool.execute<RowDataPacket[]>(
            `SELECT id, name, phone, customer_code, expiry_date 
             FROM customers 
             WHERE billing_mode = 'prepaid' 
             AND expiry_date < NOW() 
             AND is_isolated = 0 
             AND status = 'active'`
        );
        return rows;
    }

    /**
     * Process expired prepaid customers (auto isolate)
     */
    static async processExpiredCustomers(): Promise<{ isolatedCount: number; errors: any[] }> {
        const expiredCustomers = await this.getExpiredCustomers();
        let isolatedCount = 0;
        const errors: any[] = [];

        for (const customer of expiredCustomers) {
            try {
                const { IsolationService } = await import('./isolationService');
                await IsolationService.isolateCustomer({
                    customer_id: customer.id,
                    action: 'isolate',
                    reason: `Masa aktif prepaid habis pada ${new Date(customer.expiry_date).toLocaleString('id-ID')}`,
                    performed_by: 'system'
                });
                isolatedCount++;
            } catch (err: any) {
                console.error(`Error isolating prepaid customer ${customer.id}:`, err);
                errors.push({ id: customer.id, message: err.message });
            }
        }

        return { isolatedCount, errors };
    }

    /**
     * Send expiry warnings (H-3 and H-1)
     */
    static async sendExpiryWarnings(): Promise<{ h3Sent: number; h1Sent: number; errors: any[] }> {
        let h3Sent = 0;
        let h1Sent = 0;
        const errors: any[] = [];

        try {
            // H-3 Warning
            const [h3Rows] = await databasePool.execute<RowDataPacket[]>(
                `SELECT id, name, phone, expiry_date FROM customers 
                 WHERE billing_mode = 'prepaid' AND is_isolated = 0 AND status = 'active'
                 AND DATE(expiry_date) = DATE_ADD(CURDATE(), INTERVAL 3 DAY)`
            );

            for (const c of h3Rows) {
                try {
                    const msg = `Halo ${c.name}, sisa masa aktif langganan Anda tinggal 3 hari lagi. Segera lakukan perpanjangan agar layanan tidak terputus.`;
                    await whatsappService.sendMessage(c.phone, msg);
                    h3Sent++;
                } catch (err: any) { errors.push({ id: c.id, message: err.message }); }
            }

            // H-1 Warning
            const [h1Rows] = await databasePool.execute<RowDataPacket[]>(
                `SELECT id, name, phone, expiry_date FROM customers 
                 WHERE billing_mode = 'prepaid' AND is_isolated = 0 AND status = 'active'
                 AND DATE(expiry_date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
            );

            for (const c of h1Rows) {
                try {
                    const msg = `Halo ${c.name}, sisa masa aktif langganan Anda tinggal 1 hari lagi. Segera lakukan perpanjangan hari ini agar layanan tidak terputus besok.`;
                    await whatsappService.sendMessage(c.phone, msg);
                    h1Sent++;
                } catch (err: any) { errors.push({ id: c.id, message: err.message }); }
            }

        } catch (error: any) {
            console.error('[PrepaidService] Error sending warnings:', error);
            errors.push({ message: error.message });
        }

        return { h3Sent, h1Sent, errors };
    }
}
