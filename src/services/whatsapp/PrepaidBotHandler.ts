/**
 * Prepaid Bot Handler
 * Handles WhatsApp Bot interactions for prepaid customers
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { PrepaidService } from '../billing/PrepaidService';
import { WhatsAppClient } from './WhatsAppClient';
import fs from 'fs';
import path from 'path';

export class PrepaidBotHandler {

    /**
     * Handle /beli command for prepaid customers
     */
    static async handleBuyCommand(customerPhone: string, customer: any): Promise<string> {
        try {
            // Check if customer is in prepaid mode
            if (customer.billing_mode !== 'prepaid') {
                return `⚠️ *Fitur Ini Untuk Pelanggan Prabayar*\n\nMaaf, fitur pembelian paket ini khusus untuk pelanggan dengan sistem prabayar.\n\nAnda saat ini menggunakan sistem tagihan bulanan.\n\nSilakan hubungi admin jika ingin beralih ke sistem prabayar.`;
            }

            // Get customer's current package
            const [packages] = await databasePool.query<RowDataPacket[]>(
                `SELECT pp.id, pp.name, pp.price_7_days, pp.price_14_days, pp.price_30_days,
                        pp.is_enabled_7_days, pp.is_enabled_14_days, pp.is_enabled_30_days,
                        pr.name as profile_name
                 FROM customers c
                 LEFT JOIN pppoe_profiles pr ON c.pppoe_profile_id = pr.id
                 LEFT JOIN pppoe_packages pp ON pr.id = pp.profile_id
                 WHERE c.id = ?
                 LIMIT 1`,
                [customer.id]
            );

            if (!packages || packages.length === 0 || !packages[0].id) {
                return `❌ *Paket Tidak Ditemukan*\n\nMaaf, sistem tidak dapat menemukan paket Anda.\nSilakan hubungi admin untuk bantuan.`;
            }

            const pkg = packages[0];
            const price7Days = parseFloat(pkg.price_7_days || '0');
            const price14Days = parseFloat(pkg.price_14_days || '0');
            const price30Days = parseFloat(pkg.price_30_days || '0');

            const isEnabled7 = !!pkg.is_enabled_7_days;
            const isEnabled14 = !!pkg.is_enabled_14_days;
            const isEnabled30 = !!pkg.is_enabled_30_days;

            if ((price7Days === 0 || !isEnabled7) &&
                (price14Days === 0 || !isEnabled14) &&
                (price30Days === 0 || !isEnabled30)) {
                return `❌ *Layanan Prabayar Tidak Aktif*\n\nMaaf, saat ini tidak ada paket prabayar yang tersedia untuk paket Anda.\nSilakan hubungi admin untuk bantuan.`;
            }

            // Show package options
            let message = `📦 *PILIHAN PAKET INTERNET*\n\n`;
            message += `Paket Anda: *${pkg.profile_name || pkg.name}*\n\n`;

            message += `*Pilih Durasi:*\n\n`;

            if (price7Days > 0 && isEnabled7) {
                message += `1️⃣ *Paket Mingguan (7 Hari)*\n`;
                message += `   💰 Harga: Rp ${price7Days.toLocaleString('id-ID')}\n\n`;
            }

            if (price14Days > 0 && isEnabled14) {
                message += `2️⃣ *Paket 2 Minggu (14 Hari)*\n`;
                message += `   💰 Harga: Rp ${price14Days.toLocaleString('id-ID')}\n\n`;
            }

            if (price30Days > 0 && isEnabled30) {
                message += `3️⃣ *Paket Bulanan (30 Hari)*\n`;
                message += `   💰 Harga: Rp ${price30Days.toLocaleString('id-ID')}\n`;
                message += `   💡 Lebih hemat!\n\n`;
            }

            message += `*Cara Membeli:*\n`;
            message += `Ketik angka pilihan Anda:\n`;
            if (price7Days > 0 && isEnabled7) message += `• Ketik *1* untuk paket mingguan\n`;
            if (price14Days > 0 && isEnabled14) message += `• Ketik *2* untuk paket 2 minggu\n`;
            if (price30Days > 0 && isEnabled30) message += `• Ketik *3* untuk paket bulanan\n`;

            // Show current expiry info
            if (customer.expiry_date) {
                const expiryDate = new Date(customer.expiry_date);
                const now = new Date();

                if (expiryDate > now) {
                    message += `\n⏰ *Masa Aktif Saat Ini:*\n`;
                    message += `Aktif sampai: ${expiryDate.toLocaleString('id-ID', {
                        dateStyle: 'full',
                        timeStyle: 'short'
                    })}\n`;
                    message += `\n💡 *Note:* Pembelian akan menambah masa aktif Anda.`;
                } else {
                    message += `\n⚠️ *Masa Aktif Habis!*\n`;
                    message += `Silakan beli paket untuk mengaktifkan kembali internet Anda.`;
                }
            }

            return message;

        } catch (error: any) {
            console.error('[PrepaidBotHandler] Error in handleBuyCommand:', error);
            return `❌ Terjadi kesalahan sistem.\nSilakan coba lagi atau hubungi admin.`;
        }
    }

    /**
     * Handle package selection (1 or 2)
     */
    static async handlePackageSelection(
        customerPhone: string,
        customer: any,
        selection: string
    ): Promise<string> {
        try {
            // Validate selection
            if (selection !== '1' && selection !== '2' && selection !== '3') {
                return null; // Not a package selection command
            }

            // Check if customer is in prepaid mode
            if (customer.billing_mode !== 'prepaid') {
                return null;
            }

            // Get package info
            const [packages] = await databasePool.query<RowDataPacket[]>(
                `SELECT pp.id, pp.name, pp.price_7_days, pp.price_14_days, pp.price_30_days,
                        pp.is_enabled_7_days, pp.is_enabled_14_days, pp.is_enabled_30_days
                 FROM customers c
                 LEFT JOIN pppoe_profiles pr ON c.pppoe_profile_id = pr.id
                 LEFT JOIN pppoe_packages pp ON pr.id = pp.profile_id
                 WHERE c.id = ?
                 LIMIT 1`,
                [customer.id]
            );

            if (!packages || packages.length === 0) {
                return `❌ Paket tidak ditemukan. Silakan hubungi admin.`;
            }

            const pkg = packages[0];
            let duration = 0;
            let price = 0;

            if (selection === '1') {
                duration = 7;
                price = parseFloat(pkg.price_7_days || '0');
            } else if (selection === '2') {
                duration = 14;
                price = parseFloat(pkg.price_14_days || '0');
            } else if (selection === '3') {
                duration = 30;
                price = parseFloat(pkg.price_30_days || '0');
            } else {
                return `❌ Pilihan paket tidak valid. Silakan pilih 1, 2, atau 3.`;
            }

            if (price === 0) {
                return `❌ Harga paket ${duration} hari belum dikonfigurasi.\nSilakan pilih paket lain atau hubungi admin.`;
            }

            // Generate payment request with unique code
            const result = await PrepaidService.generatePaymentRequest(
                customer.id,
                pkg.id,
                duration
            );

            if (!result.success || !result.paymentRequest) {
                return `❌ Gagal membuat kode pembayaran.\nError: ${result.message || 'Unknown error'}\n\nSilakan coba lagi.`;
            }

            const pr = result.paymentRequest;

            // Build payment instruction message
            let message = `✅ *INSTRUKSI PEMBAYARAN*\n\n`;
            message += `📦 Paket: ${pkg.name} (${duration} hari)\n`;

            const base = parseFloat(pr.base_amount || 0);
            const disc = parseFloat(pr.voucher_discount || 0);
            const device = parseFloat(pr.device_fee || 0);
            const ppn = parseFloat(pr.ppn_amount || 0);
            const unique = parseFloat(pr.unique_code || 0);

            message += `   Harga Paket: Rp ${base.toLocaleString('id-ID')}\n`;
            if (disc > 0) message += `   Diskon: -Rp ${disc.toLocaleString('id-ID')}\n`;
            if (device > 0) message += `   Sewa Perangkat: Rp ${device.toLocaleString('id-ID')}\n`;
            if (ppn > 0) message += `   PPN: Rp ${ppn.toLocaleString('id-ID')}\n`;
            message += `   Kode Unik: ${unique}\n`;

            message += `~~~~~~~~~~~~~~~~~~~~~~\n`;
            message += `💰 *TOTAL BAYAR: Rp ${parseFloat(pr.total_amount).toLocaleString('id-ID')}*\n\n`;

            message += `⏰ *Berlaku hingga:* ${new Date(pr.expires_at).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short'
            })}\n`;
            message += `   (1 jam dari sekarang)\n\n`;

            message += `*📋 CARA PEMBAYARAN:*\n\n`;

            message += `*OPSI 1: QRIS (Scan & Bayar)*\n`;
            message += `Scan QR Code yang akan dikirim setelah pesan ini.\n\n`;

            message += `*OPSI 2: Transfer Bank*\n`;
            message += `BCA: 1234567890\n`;
            message += `a/n: PT Internet Jaya\n\n`;

            message += `⚠️ *PENTING:*\n`;
            message += `• Transfer TEPAT sampai 3 digit terakhir\n`;
            message += `• Jumlah: *Rp ${parseFloat(pr.total_amount).toLocaleString('id-ID')}*\n`;
            message += `• Jangan lebih, jangan kurang\n`;
            message += `• Kode unik membantu sistem mengenali pembayaran Anda\n\n`;

            message += `*📸 SETELAH TRANSFER:*\n`;
            message += `Kirim foto bukti transfer ke nomor ini.\n`;
            message += `Sistem AI akan memverifikasi otomatis!\n\n`;

            message += `💡 Jika lewat 1 jam, ketik */beli* lagi untuk kode baru.`;

            // Send message first
            const waClient = WhatsAppClient.getInstance();
            await waClient.sendMessage(customerPhone, message);

            // Send QRIS image if exists
            const qrisPath = path.join(process.cwd(), 'public', 'images', 'payments', 'qris.png');
            if (fs.existsSync(qrisPath)) {
                try {
                    console.log('[PrepaidBotHandler] 📤 Sending QRIS image...');

                    const waClient = WhatsAppClient.getInstance();
                    await waClient.sendImage(
                        customerPhone,
                        qrisPath,
                        '📱 Scan QR Code ini untuk pembayaran via QRIS'
                    );

                    console.log('[PrepaidBotHandler] ✅ QRIS image sent successfully');
                } catch (qrisError) {
                    console.error('[PrepaidBotHandler] ❌ Error sending QRIS:', qrisError);
                }
            } else {
                console.log('[PrepaidBotHandler] ⚠️ QRIS image not found at:', qrisPath);
            }

            return ''; // Message already sent above

        } catch (error: any) {
            console.error('[PrepaidBotHandler] Error in handlePackageSelection:', error);
            return `❌ Terjadi kesalahan: ${error.message}`;
        }
    }

    /**
     * Check if customer in prepaid mode
     */
    static async isCustomerPrepaid(customerId: number): Promise<boolean> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT billing_mode FROM customers WHERE id = ?',
                [customerId]
            );

            return rows && rows.length > 0 && rows[0].billing_mode === 'prepaid';
        } catch (error) {
            console.error('[PrepaidBotHandler] Error checking prepaid status:', error);
            return false;
        }
    }

    /**
     * Send payment confirmation with invoice
     */
    static async sendPaymentConfirmation(
        customerPhone: string,
        customer: any,
        transaction: any
    ): Promise<void> {
        try {
            const newExpiry = new Date(transaction.new_expiry_date);

            let message = `✅ *PEMBAYARAN BERHASIL!*\n\n`;
            message += `🎉 Terima kasih atas pembayaran Anda!\n\n`;

            message += `*📋 DETAIL TRANSAKSI:*\n`;
            message += `💰 Jumlah: Rp ${parseFloat(transaction.amount).toLocaleString('id-ID')}\n`;
            message += `⏱️ Durasi: ${transaction.duration_days} hari\n`;
            message += `📅 Tanggal: ${new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}\n\n`;

            message += `*⏰ MASA AKTIF BARU:*\n`;
            message += `Aktif sampai: ${newExpiry.toLocaleString('id-ID', {
                dateStyle: 'full',
                timeStyle: 'short'
            })}\n\n`;

            message += `*🌐 STATUS INTERNET:*\n`;
            message += `✅ Internet Anda sudah aktif!\n\n`;

            message += `💡 *Tips:*\n`;
            message += `• Internet akan otomatis berhenti saat masa aktif habis\n`;
            message += `• Isi ulang sebelum tanggal di atas agar tidak terputus\n`;
            message += `• Ketik */beli* kapan saja untuk perpanjang\n\n`;

            message += `Terima kasih telah menggunakan layanan kami! 🙏`;

            const waClient = WhatsAppClient.getInstance();
            await waClient.sendMessage(customerPhone, message);

        } catch (error) {
            console.error('[PrepaidBotHandler] Error sending confirmation:', error);
        }
    }
}
