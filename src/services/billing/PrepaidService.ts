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
        durationDays: number,
        options: {
            voucherCode?: string;
            paymentMethodId?: number;
        } = {}
    ): Promise<{
        success: boolean;
        paymentRequest?: any;
        message?: string;
    }> {
        const conn = await databasePool.getConnection();
        const { voucherCode, paymentMethodId } = options;

        try {
            await conn.beginTransaction();

            // Dynamic imports
            const { VoucherService } = await import('./VoucherService');

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

            // Voucher Logic
            let voucherId: number | null = null;
            let discountAmount = 0;

            if (voucherCode) {
                const validation = await VoucherService.validateVoucher(voucherCode, customerId, baseAmount);
                if (validation.valid && validation.voucher) {
                    voucherId = validation.voucher.id;

                    if (validation.voucher.discount_type === 'percentage') {
                        discountAmount = (baseAmount * validation.voucher.discount_value) / 100;
                    } else if (validation.voucher.discount_type === 'fixed') {
                        discountAmount = validation.voucher.discount_value;
                    }
                    // Free days is handled after payment? Or just bonus days?
                    // Usually free days doesn't reduce price.

                    // Cap discount at baseAmount (no negative price)
                    if (discountAmount > baseAmount) {
                        discountAmount = baseAmount;
                    }
                } else {
                    // Optional: Fail if voucher invalid, or just ignore?
                    // User expectation: If I enter invalid code, tell me.
                    throw new Error(validation.message || 'Invalid voucher code');
                }
            }

            // Get Settings for PPN and Device Rental
            const { SettingsService } = await import('../SettingsService');
            const ppnEnabled = await SettingsService.getBoolean('ppn_enabled');
            const ppnRate = ppnEnabled ? await SettingsService.getNumber('ppn_rate') : 0;
            const deviceRentalEnabled = await SettingsService.getBoolean('device_rental_enabled');
            const deviceRentalFee = await SettingsService.getNumber('device_rental_fee');

            // Check if customer has device rental
            const [custRows] = await conn.query<RowDataPacket[]>(
                'SELECT use_device_rental, is_taxable FROM customers WHERE id = ?',
                [customerId]
            );
            const useDeviceRental = custRows.length > 0 && custRows[0].use_device_rental;
            const isTaxable = custRows.length > 0 && custRows[0].is_taxable;

            // Calculate Components
            let appliedDeviceFee = 0;
            if (deviceRentalEnabled && useDeviceRental) {
                appliedDeviceFee = deviceRentalFee;
            }

            let amountAfterDiscount = baseAmount - discountAmount;
            if (amountAfterDiscount < 0) amountAfterDiscount = 0;

            const subtotal = amountAfterDiscount + appliedDeviceFee;

            let ppnAmount = 0;
            if (ppnEnabled && ppnRate > 0 && isTaxable) {
                ppnAmount = Math.floor(subtotal * (ppnRate / 100));
            }

            // Generate unique 3-digit code (100-999)
            let uniqueCode: number;
            let attempts = 0;
            const maxAttempts = 50;

            while (attempts < maxAttempts) {
                uniqueCode = Math.floor(Math.random() * 900) + 100; // 100-999

                // Calculate total amount (Base - Discount + UniqueCode)
                // Unique code is decimal part (e.g. 500 -> 500.00, need .500?)
                // Original logic: totalAmount = baseAmount + (uniqueCode / 100);
                // If uniqueCode is 123, added is 1.23 ?? No 100-999 / 100 = 1.00 - 9.99
                // Wait, unique code logic in original: `(uniqueCode / 100)`.
                // If base is 50000. Code 123. Total 50001.23.

                // Total = Subtotal + PPN + UniqueCode
                const finalTotal = subtotal + ppnAmount + uniqueCode;

                // Check collision
                const [existing] = await conn.query<RowDataPacket[]>(
                    `SELECT id FROM payment_requests 
                     WHERE total_amount = ? 
                     AND status = 'pending' 
                     AND expires_at > NOW()`,
                    [finalTotal.toFixed(2)] // Assuming total_amount is DECIMAL
                );

                if (!existing || existing.length === 0) {
                    // Code is unique, create payment request
                    const expiresAt = new Date();
                    expiresAt.setHours(expiresAt.getHours() + 1); // Valid for 1 hour

                    const [result] = await conn.query<ResultSetHeader>(
                        `INSERT INTO payment_requests 
                         (customer_id, package_id, duration_days, base_amount, unique_code, total_amount, 
                          expires_at, voucher_id, voucher_discount, payment_method_id,
                          ppn_rate, ppn_amount, device_fee, subtotal_amount)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            customerId,
                            packageId,
                            durationDays,
                            baseAmount,
                            uniqueCode,
                            finalTotal.toFixed(2),
                            expiresAt,
                            voucherId,
                            discountAmount,
                            paymentMethodId || null,
                            ppnRate,
                            ppnAmount,
                            appliedDeviceFee,
                            subtotal
                        ]
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

            // Update customer expiry date and un-isolate
            await conn.query(
                `UPDATE customers 
                 SET expiry_date = ?, is_isolated = 0
                 WHERE id = ?`,
                [newExpiryDate, request.customer_id]
            );

            // Log transaction
            const [txResult] = await conn.query<ResultSetHeader>(
                `INSERT INTO prepaid_transactions 
                 (customer_id, payment_request_id, package_id, duration_days, amount, 
                  payment_method, previous_expiry_date, new_expiry_date, verified_by,
                  ppn_amount, device_fee)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    request.customer_id,
                    paymentRequestId,
                    request.package_id,
                    request.duration_days,
                    request.total_amount,
                    paymentMethod,
                    request.current_expiry,
                    newExpiryDate,
                    verifiedBy,
                    request.ppn_amount || 0,
                    request.device_fee || 0
                ]
            );

            const transactionId = txResult.insertId;

            // Generate Invoice for Prepaid Purchase (for official bookkeeping)
            try {
                const { InvoiceService } = await import('./invoiceService');
                const period = new Date().toISOString().substring(0, 7); // Use current month YYYY-MM

                const invoiceData = {
                    customer_id: request.customer_id,
                    period: period,
                    due_date: new Date().toISOString().split('T')[0],
                    subtotal: parseFloat(request.subtotal_amount || 0),
                    discount_amount: parseFloat(request.voucher_discount || 0),
                    ppn_rate: parseFloat(request.ppn_rate || 0),
                    ppn_amount: parseFloat(request.ppn_amount || 0),
                    device_fee: parseFloat(request.device_fee || 0),
                    total_amount: parseFloat(request.total_amount || 0),
                    paid_amount: parseFloat(request.total_amount || 0), // Prepaid is already paid
                    status: 'paid',
                    notes: `Prepaid Purchase - Package: ${request.package_name || 'N/A'} (${request.duration_days} Days)`
                };

                const invoiceItems = [
                    {
                        description: `Paket ${request.package_name || 'Internet'} - ${request.duration_days} Hari`,
                        quantity: 1,
                        unit_price: parseFloat(request.base_amount || 0),
                        total_price: parseFloat(request.base_amount || 0)
                    }
                ];

                // Add Device Fee as invoice item if applicable
                if (parseFloat(request.device_fee || 0) > 0) {
                    invoiceItems.push({
                        description: 'Sewa Perangkat (Prepaid)',
                        quantity: 1,
                        unit_price: parseFloat(request.device_fee),
                        total_price: parseFloat(request.device_fee)
                    });
                }

                // Create the invoice
                const invoiceId = await InvoiceService.createInvoice(invoiceData as any, invoiceItems);

                // Link invoice back to transaction
                await conn.query(
                    'UPDATE prepaid_transactions SET invoice_id = ? WHERE id = ?',
                    [invoiceId, transactionId]
                );

                console.log(`✅ Invoice ${invoiceId} created for prepaid transaction ${transactionId}`);
            } catch (invoiceError) {
                console.error('⚠️ Failed to create invoice for prepaid transaction:', invoiceError);
                // We don't rollback the whole thing if invoice creation fails, 
                // but we should log it. The customer already has their expiry extended.
            }

            // Log Voucher Usage
            if (request.voucher_id) {
                const { VoucherService } = await import('./VoucherService');
                await VoucherService.logVoucherUsage(
                    request.voucher_id,
                    request.customer_id,
                    paymentRequestId,
                    request.voucher_discount,
                    request.base_amount,
                    request.total_amount
                );
            }

            // Check Referral
            const { ReferralService } = await import('./ReferralService');
            const referral = await ReferralService.getReferralByReferredId(request.customer_id);
            if (referral && referral.status === 'pending') {
                await ReferralService.completeReferral(referral.id);
            }

            await conn.commit();

            // Re-enable in Mikrotik asynchronously
            try {
                if (request.customer_code) { // Assuming we can look up username if needed, or query it
                    // We need customer details for Mikrotik
                    const [custRows] = await databasePool.query<RowDataPacket[]>(
                        'SELECT pppoe_username, phone, name FROM customers WHERE id = ?',
                        [request.customer_id]
                    );

                    if (custRows.length > 0 && custRows[0].pppoe_username) {
                        const { MikrotikService } = await import('../mikrotik/MikrotikService');
                        const mikrotik = await MikrotikService.getInstance();
                        await mikrotik.updatePPPoEUserByUsername(custRows[0].pppoe_username, { disabled: false });

                        // Send WhatsApp Notification
                        if (custRows[0].phone) {
                            const { WhatsAppServiceBaileys } = await import('../whatsapp/WhatsAppServiceBaileys');

                            const base = parseFloat(request.base_amount || 0);
                            const disc = parseFloat(request.voucher_discount || 0);
                            const device = parseFloat(request.device_fee || 0);
                            const ppn = parseFloat(request.ppn_amount || 0);
                            const total = parseFloat(request.total_amount || 0);

                            let msg = `✅ *PEMBAYARAN DITERIMA*\n\n`;
                            msg += `Halo *${custRows[0].name}*,\n`;
                            msg += `Pembayaran Anda telah kami terima.\n\n`;

                            msg += `*RINCIAN TRANSAKSI:* \n`;
                            msg += `Paket: Rp ${base.toLocaleString('id-ID')}\n`;
                            if (disc > 0) msg += `Diskon: -Rp ${disc.toLocaleString('id-ID')}\n`;
                            if (device > 0) msg += `Sewa Perangkat: Rp ${device.toLocaleString('id-ID')}\n`;
                            if (ppn > 0) msg += `PPN: Rp ${ppn.toLocaleString('id-ID')}\n`;
                            msg += `Total: Rp ${total.toLocaleString('id-ID')}\n\n`;

                            msg += `Layanan internet Anda telah *DIAKTIFKAN KEMBALI*.\n`;
                            msg += `Aktif sampai: ${newExpiryDate.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}\n\n`;
                            msg += `Terima kasih!`;

                            await WhatsAppServiceBaileys.sendMessage(custRows[0].phone, msg);
                        }
                    }
                }
            } catch (mtError) {
                console.error('Failed to reactivate Mikrotik user:', mtError);
            }

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

    /**
     * Process expired customers: Isolate them + Notify
     */
    static async processExpiredCustomers(): Promise<{ isolatedCount: number; errors: string[] }> {
        const customers = await this.getExpiredCustomers();
        let isolatedCount = 0;
        const errors: string[] = [];

        if (customers.length === 0) return { isolatedCount: 0, errors: [] };

        const { MikrotikService } = await import('../mikrotik/MikrotikService');
        const { WhatsAppServiceBaileys } = await import('../whatsapp/WhatsAppServiceBaileys');

        let mikrotik = null;
        try {
            mikrotik = await MikrotikService.getInstance();
        } catch (e) {
            console.error('Mikrotik service not available for isolation');
        }

        for (const customer of customers) {
            const conn = await databasePool.getConnection();
            try {
                await conn.beginTransaction();

                // 1. Mark as isolated in DB
                await conn.query('UPDATE customers SET is_isolated = 1 WHERE id = ?', [customer.id]);

                // 2. Disable in Mikrotik
                if (mikrotik && customer.pppoe_username) {
                    await mikrotik.updatePPPoEUserByUsername(customer.pppoe_username, { disabled: true });
                    await mikrotik.disconnectPPPoEUser(customer.pppoe_username); // Kick
                }

                await conn.commit();
                isolatedCount++;

                // 3. Notify
                if (customer.phone) {
                    const message = `⚠️ *LAYANAN INTERNET BERAKHIR*\n\nHalo ${customer.name},\nMasa aktif paket internet Anda telah *HABIS*.\n\nLayanan internet Anda sementara dinonaktifkan.\nUntuk mengaktifkan kembali, silakan lakukan pembelian paket.\n\nKetik */menu* untuk membeli paket.\n\nTerima kasih.`;
                    await WhatsAppServiceBaileys.sendMessage(customer.phone, message).catch(err => console.error('WA Error:', err));
                }

            } catch (error: any) {
                await conn.rollback();
                errors.push(`Failed to isolate ${customer.name}: ${error.message}`);
            } finally {
                conn.release();
            }
        }

        return { isolatedCount, errors };
    }
}
