"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageChangeNotificationService = void 0;
const PackageChangeValidationService_1 = require("../billing/PackageChangeValidationService");
const pool_1 = require("../../db/pool");
class PackageChangeNotificationService {
    /**
     * Mengirim notifikasi WhatsApp ke pelanggan tentang tagihan tertunggak sebelum perubahan paket
     * @param customerId ID pelanggan
     * @returns Status pengiriman notifikasi
     */
    static async sendOutstandingInvoiceNotification(customerId) {
        try {
            // Dapatkan informasi pelanggan
            const customer = await this.getCustomerInfo(customerId);
            if (!customer) {
                return { success: false, message: 'Pelanggan tidak ditemukan' };
            }
            // Dapatkan daftar tagihan tertunggak
            const outstandingInvoices = await PackageChangeValidationService_1.PackageChangeValidationService.getOutstandingInvoices(customerId);
            if (outstandingInvoices.length === 0) {
                return { success: false, message: 'Tidak ada tagihan tertunggak untuk pelanggan ini' };
            }
            // Format pesan notifikasi
            const message = this.formatOutstandingInvoiceMessage(customer, outstandingInvoices);
            // Kirim notifikasi WhatsApp
            const sendMessageResult = await this.sendWhatsAppMessage(customer.phone, message);
            if (sendMessageResult.success) {
                console.log(`[PackageChangeNotification] Notifikasi dikirim ke ${customer.name} (${customer.phone})`);
                return { success: true, message: `Notifikasi berhasil dikirim ke ${customer.phone}` };
            }
            else {
                console.error(`[PackageChangeNotification] Gagal mengirim notifikasi ke ${customer.name} (${customer.phone}):`, sendMessageResult.message);
                return { success: false, message: `Gagal mengirim notifikasi: ${sendMessageResult.message}` };
            }
        }
        catch (error) {
            console.error('[PackageChangeNotification] Error sending notification:', error);
            return { success: false, message: 'Terjadi kesalahan saat mengirim notifikasi' };
        }
    }
    /**
     * Format pesan notifikasi tagihan tertunggak
     */
    static formatOutstandingInvoiceMessage(customer, invoices) {
        const totalAmount = invoices.reduce((sum, inv) => sum + inv.remaining_amount, 0);
        let message = `🔔 *NOTIFIKASI PENTING*\n\n`;
        message += ` Halo *${customer.name}*,\n\n`;
        message += ` Kami menemukan bahwa Anda memiliki *${invoices.length} tagihan tertunggak* dengan total:\n`;
        message += ` *Rp. ${totalAmount.toLocaleString('id-ID')}*\n\n`;
        message += ` *Daftar Tagihan Tertunggak:*\n`;
        invoices.forEach((invoice, index) => {
            message += ` • ${invoice.invoice_number} (Periode: ${invoice.period}) - Rp. ${invoice.remaining_amount.toLocaleString('id-ID')}\n`;
        });
        message += `\n Untuk dapat mengganti paket, mohon selesaikan pembayaran tagihan-tagihan di atas terlebih dahulu.\n\n`;
        message += ` Silakan hubungi kami jika ada pertanyaan terkait tagihan Anda.\n\n`;
        message += ` Terima kasih.`;
        return message;
    }
    /**
     * Mendapatkan informasi pelanggan
     */
    static async getCustomerInfo(customerId) {
        const [rows] = await pool_1.databasePool.query('SELECT id, name, phone, billing_mode FROM customers WHERE id = ?', [customerId]);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    }
    /**
     * Fungsi untuk mengirim pesan WhatsApp
     * Menggunakan layanan WhatsApp yang sudah ada di sistem
     */
    static async sendWhatsAppMessage(phone, message) {
        try {
            // Cek apakah WhatsApp service tersedia
            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('./WhatsAppService')));
            if (!phone) {
                return { success: false, message: 'Nomor telepon pelanggan tidak tersedia' };
            }
            // Format nomor telepon (hapus karakter selain angka)
            const formattedPhone = phone.replace(/\D/g, '');
            // Kirim pesan
            await whatsappService.sendMessage(formattedPhone, message);
            return { success: true, message: 'Pesan berhasil dikirim' };
        }
        catch (error) {
            // Jika gagal mengirim melalui WhatsApp service, log error dan kembalikan pesan kesalahan
            console.error('[PackageChangeNotification] Error sending WhatsApp message:', error?.message || error);
            return { success: false, message: error?.message || 'Gagal mengirim pesan WhatsApp' };
        }
    }
    /**
     * Mengirim notifikasi ke semua pelanggan dengan tagihan tertunggak
     * Digunakan untuk notifikasi massal
     */
    static async sendBulkOutstandingInvoiceNotifications() {
        try {
            // Dapatkan semua pelanggan dengan tagihan tertunggak
            const query = `
        SELECT DISTINCT c.id, c.name, c.phone
        FROM customers c
        JOIN invoices i ON c.id = i.customer_id
        WHERE i.status IN ('sent', 'partial', 'overdue')
          AND i.remaining_amount > 0
          AND c.billing_mode = 'postpaid'
          AND c.phone IS NOT NULL
          AND c.phone != ''
      `;
            const [customerRows] = await pool_1.databasePool.query(query);
            const customers = customerRows;
            let successCount = 0;
            let failureCount = 0;
            const results = [];
            // Kirim notifikasi ke setiap pelanggan
            for (const customer of customers) {
                const result = await this.sendOutstandingInvoiceNotification(customer.id);
                results.push({ customerId: customer.id, success: result.success, message: result.message });
                if (result.success) {
                    successCount++;
                }
                else {
                    failureCount++;
                }
                // Delay kecil antar pengiriman untuk menghindari spam
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            console.log(`[PackageChangeNotification] Bulk notification completed. Success: ${successCount}, Failed: ${failureCount}`);
            return { successCount, failureCount, results };
        }
        catch (error) {
            console.error('[PackageChangeNotification] Error in bulk notification:', error);
            throw error;
        }
    }
}
exports.PackageChangeNotificationService = PackageChangeNotificationService;
//# sourceMappingURL=PackageChangeNotificationService.js.map