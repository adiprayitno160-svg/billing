import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Prepaid Service
 * Handles all prepaid billing operations
 */
export class PrepaidService {

    /**
     * Switch customer to prepaid mode
     * Sends WhatsApp notification if phone is available
     */
    static async switchToPrepaid(
        customerId: number,
        initialDays: number = 1,
        sendNotification: boolean = true
    ): Promise<{ success: boolean; message: string; expiryDate?: Date }> {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            // Get customer info
            const [customers] = await conn.query<RowDataPacket[]>(
                'SELECT id, name, phone, billing_mode, pppoe_profile_id FROM customers WHERE id = ?',
                [customerId]
            );

            if (!customers || customers.length === 0) {
                throw new Error('Customer not found');
            }

            const customer = customers[0];

            // Check if already prepaid
            if (customer.billing_mode === 'prepaid') {
                await conn.rollback();
                return { success: false, message: 'Customer already in prepaid mode' };
            }

            // Calculate expiry date (bonus initial days)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + initialDays);

            // Update customer to prepaid mode
            await conn.query(
                `UPDATE customers 
                 SET billing_mode = 'prepaid', expiry_date = ?
                 WHERE id = ?`,
                [expiryDate, customerId]
            );

            // Get package info for notification
            let packageName = 'Paket Internet';
            if (customer.pppoe_profile_id) {
                const [profiles] = await conn.query<RowDataPacket[]>(
                    'SELECT name FROM pppoe_profiles WHERE id = ?',
                    [customer.pppoe_profile_id]
                );
                if (profiles && profiles.length > 0) {
                    packageName = profiles[0].name;
                }
            }

            await conn.commit();

            // Send WhatsApp notification
            if (sendNotification && customer.phone) {
                try {
                    const { WhatsAppServiceBaileys } = await import('../whatsapp/WhatsAppServiceBaileys');

                    const message = `📢 *INFORMASI PENTING - PERUBAHAN SISTEM PEMBAYARAN*

Halo *${customer.name}*,

Per hari ini, akun internet Anda telah dialihkan ke *Sistem Layanan Prabayar (Isi Ulang)*.

📋 *Informasi Paket Anda:*
✅ Paket: ${packageName}
✅ Bonus Masa Aktif: ${initialDays} hari
⏰ Aktif Sampai: ${expiryDate.toLocaleString('id-ID', {
                        dateStyle: 'full',
                        timeStyle: 'short'
                    })}

💡 *Cara Menggunakan Sistem Baru:*
1️⃣ Ketik */menu* untuk melihat pilihan paket
2️⃣ Pilih paket yang Anda inginkan (7 hari / 30 hari)
3️⃣ Sistem akan memberikan kode pembayaran unik
4️⃣ Transfer sesuai nominal + kode unik
5️⃣ Kirim bukti transfer ke sini
6️⃣ Sistem AI akan verifikasi otomatis

⚠️ *Penting:*
• Pastikan isi ulang sebelum masa aktif habis
• Internet akan otomatis berhenti jika tidak diisi ulang
• Tidak ada lagi sistem tagihan bulanan

🎁 *Bonus Perkenalan:*
Sebagai apresiasi, kami berikan bonus ${initialDays} hari masa aktif gratis!

Ada pertanyaan? Silakan balas pesan ini atau ketik */help*

Terima kasih atas pengertiannya! 🙏`;

                    await WhatsAppServiceBaileys.sendMessage(customer.phone, message);
                    console.log(`✅ Prepaid migration notification sent to ${customer.name} (${customer.phone})`);
                } catch (notifError) {
                    console.error('Failed to send WhatsApp notification:', notifError);
                    // Don't throw - customer is still migrated
                }
            }

            return {
                success: true,
                message: `Customer switched to prepaid mode with ${initialDays} day(s) bonus`,
                expiryDate
            };

        } catch (error: any) {
            await conn.rollback();
            console.error('Error switching customer to prepaid:', error);
            throw error;
        } finally {
            conn.release();
        }
    }

    /**
     * Switch customer back to postpaid mode
     */
    static async switchToPostpaid(customerId: number): Promise<{ success: boolean; message: string }> {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            // Update customer to postpaid mode (remove expiry_date)
            await conn.query(
                `UPDATE customers 
                 SET billing_mode = 'postpaid', expiry_date = NULL
                 WHERE id = ?`,
                [customerId]
            );

            await conn.commit();

            return {
                success: true,
                message: 'Customer switched back to postpaid mode (monthly invoicing)'
            };

        } catch (error: any) {
            await conn.rollback();
            console.error('Error switching customer to postpaid:', error);
            throw error;
        } finally {
            conn.release();
        }
    }

    /**
     * Generate unique payment code (3 digits)
     * Ensures no collision within the same hour
     */
    static async generatePaymentRequest(
        customerId: number,
        packageId: number,
        durationDays: number
    ): Promise<{
        success: boolean;
        paymentRequest?: any;
        message?: string;
    }> {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            // Get package price
            const [packages] = await conn.query<RowDataPacket[]>(
                `SELECT id, name, 
                 CASE 
                     WHEN ? = 7 THEN price_7_days
                     WHEN ? = 30 THEN price_30_days
                     ELSE price
                 END as price
                 FROM pppoe_packages WHERE id = ?`,
                [durationDays, durationDays, packageId]
            );

            if (!packages || packages.length === 0) {
                throw new Error('Package not found');
            }

            const pkg = packages[0];
            const baseAmount = parseFloat(pkg.price || '0');

            if (baseAmount <= 0) {
                throw new Error(`Package price not configured for ${durationDays} days`);
            }

            // Generate unique 3-digit code (100-999)
            let uniqueCode: number;
            let attempts = 0;
            const maxAttempts = 50;

            while (attempts < maxAttempts) {
                uniqueCode = Math.floor(Math.random() * 900) + 100; // 100-999
                const totalAmount = baseAmount + (uniqueCode / 100); // Add as decimal

                // Check if this code already exists (active within last 2 hours)
                const [existing] = await conn.query<RowDataPacket[]>(
                    `SELECT id FROM payment_requests 
                     WHERE total_amount = ? 
                     AND status = 'pending' 
                     AND expires_at > NOW()`,
                    [totalAmount.toFixed(2)]
                );

                if (!existing || existing.length === 0) {
                    // Code is unique, create payment request
                    const expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + 1); // Valid for 1 hour

                    const [result] = await conn.query<ResultSetHeader>(
                        `INSERT INTO payment_requests 
                         (customer_id, package_id, duration_days, base_amount, unique_code, total_amount, expires_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [customerId, packageId, durationDays, baseAmount, uniqueCode, totalAmount.toFixed(2), expiresAt]
                    );

                    await conn.commit();

                    // Get created payment request
                    const [created] = await conn.query<RowDataPacket[]>(
                        `SELECT pr.*, pp.name as package_name
                         FROM payment_requests pr
                         LEFT JOIN pppoe_packages pp ON pr.package_id = pp.id
                         WHERE pr.id = ?`,
                        [result.insertId]
                    );

                    return {
                        success: true,
                        paymentRequest: created[0]
                    };
                }

                attempts++;
            }

            throw new Error('Failed to generate unique payment code after maximum attempts');

        } catch (error: any) {
            await conn.rollback();
            console.error('Error generating payment request:', error);
            return {
                success: false,
                message: error.message
            };
        } finally {
            conn.release();
        }
    }

    /**
     * Verify payment and extend customer expiry date
     */
    static async confirmPayment(
        paymentRequestId: number,
        verifiedBy: number | null = null,
        paymentMethod: string = 'transfer'
    ): Promise<{ success: boolean; message: string; newExpiryDate?: Date }> {
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            // Get payment request
            const [requests] = await conn.query<RowDataPacket[]>(
                `SELECT pr.*, c.expiry_date as current_expiry
                 FROM payment_requests pr
                 LEFT JOIN customers c ON pr.customer_id = c.id
                 WHERE pr.id = ?`,
                [paymentRequestId]
            );

            if (!requests || requests.length === 0) {
                throw new Error('Payment request not found');
            }

            const request = requests[0];

            if (request.status !== 'pending') {
                throw new Error(`Payment request already ${request.status}`);
            }

            // Calculate new expiry date
            const currentExpiry = request.current_expiry ? new Date(request.current_expiry) : new Date();
            const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
            const newExpiryDate = new Date(baseDate);
            newExpiryDate.setDate(newExpiryDate.getDate() + request.duration_days);

            // Update payment request status
            await conn.query(
                `UPDATE payment_requests 
                 SET status = 'paid', paid_at = NOW()
                 WHERE id = ?`,
                [paymentRequestId]
            );

            // Update customer expiry date
            await conn.query(
                `UPDATE customers 
                 SET expiry_date = ?
                 WHERE id = ?`,
                [newExpiryDate, request.customer_id]
            );

            // Log transaction
            await conn.query(
                `INSERT INTO prepaid_transactions 
                 (customer_id, payment_request_id, package_id, duration_days, amount, 
                  payment_method, previous_expiry_date, new_expiry_date, verified_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    request.customer_id,
                    paymentRequestId,
                    request.package_id,
                    request.duration_days,
                    request.total_amount,
                    paymentMethod,
                    request.current_expiry,
                    newExpiryDate,
                    verifiedBy
                ]
            );

            await conn.commit();

            return {
                success: true,
                message: `Payment confirmed. Service active until ${newExpiryDate.toLocaleString('id-ID')}`,
                newExpiryDate
            };

        } catch (error: any) {
            await conn.rollback();
            console.error('Error confirming payment:', error);
            throw error;
        } finally {
            conn.release();
        }
    }

    /**
     * Get expired prepaid customers (for scheduler)
     */
    static async getExpiredCustomers(): Promise<any[]> {
        const conn = await databasePool.getConnection();

        try {
            const [customers] = await conn.query<RowDataPacket[]>(
                `SELECT id, customer_code, name, phone, pppoe_username, expiry_date, is_isolated
                 FROM customers
                 WHERE billing_mode = 'prepaid'
                 AND expiry_date IS NOT NULL
                 AND expiry_date <= NOW()
                 AND (is_isolated IS NULL OR is_isolated = 0)
                 ORDER BY expiry_date ASC`
            );

            return customers || [];

        } finally {
            conn.release();
        }
    }
}
