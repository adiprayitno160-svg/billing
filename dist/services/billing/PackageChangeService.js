"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageChangeService = void 0;
const pool_1 = require("../../db/pool");
const PackageChangeValidationService_1 = require("./PackageChangeValidationService");
const PackageChangeNotificationService_1 = require("../whatsapp/PackageChangeNotificationService");
const staticIpClientService_1 = require("../staticIpClientService");
class PackageChangeService {
    /**
     * Mengganti paket pelanggan dengan validasi pembayaran terlebih dahulu
     * @param customerId ID pelanggan
     * @param newPackageId ID paket baru
     * @param packageType Jenis paket ('static_ip' atau 'pppoe')
     * @returns Hasil perubahan paket
     */
    static async changePackageWithValidation(customerId, newPackageId, packageType) {
        try {
            // Validasi apakah pelanggan dapat mengganti paket
            const validation = await PackageChangeValidationService_1.PackageChangeValidationService.validatePackageChangeEligibility(customerId);
            if (!validation.isValid) {
                // Kirim notifikasi WhatsApp tentang tagihan tertunggak
                const notificationResult = await PackageChangeNotificationService_1.PackageChangeNotificationService.sendOutstandingInvoiceNotification(customerId);
                return {
                    success: false,
                    message: validation.message,
                    requiresPayment: true,
                    invoiceNotificationSent: notificationResult.success
                };
            }
            // Jika validasi lolos, lakukan perubahan paket berdasarkan tipe
            if (packageType === 'static_ip') {
                await this.changeStaticIpPackage(customerId, newPackageId);
            }
            else if (packageType === 'pppoe') {
                await this.changePppoePackage(customerId, newPackageId);
            }
            return {
                success: true,
                message: 'Perubahan paket berhasil dilakukan'
            };
        }
        catch (error) {
            console.error('[PackageChangeService] Error changing package:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengganti paket'
            };
        }
    }
    /**
     * Mengganti paket static IP dengan validasi
     */
    static async changeStaticIpPackage(customerId, newPackageId) {
        // Panggil fungsi asli dari staticIpClientService
        await (0, staticIpClientService_1.changeCustomerStaticIpPackage)(customerId, newPackageId);
    }
    /**
     * Mengganti paket PPPoE dengan validasi
     */
    static async changePppoePackage(customerId, newPackageId) {
        // Implementasi untuk perubahan paket PPPoE
        // Ini adalah langkah awal, nanti bisa dikembangkan lebih lanjut
        const conn = await pool_1.databasePool.getConnection();
        try {
            // Dapatkan data pelanggan dan paket lama
            const [customerRows] = await conn.query(`SELECT c.*, p.name as package_name, p.price as package_price
         FROM customers c
         LEFT JOIN pppoe_packages p ON c.pppoe_profile_id = p.profile_id
         WHERE c.id = ?`, [customerId]);
            if (!Array.isArray(customerRows) || customerRows.length === 0) {
                throw new Error('Pelanggan tidak ditemukan');
            }
            const customer = customerRows[0];
            // Dapatkan data paket baru
            const [newPackageRows] = await conn.query('SELECT * FROM pppoe_packages WHERE id = ?', [newPackageId]);
            if (!Array.isArray(newPackageRows) || newPackageRows.length === 0) {
                throw new Error('Paket baru tidak ditemukan');
            }
            const newPackage = newPackageRows[0];
            // Update paket di database (koneksi ke tabel pelanggan)
            await conn.execute('UPDATE customers SET pppoe_profile_id = ? WHERE id = ?', [newPackage.profile_id, customerId]);
            // Update subscription
            await conn.execute(`UPDATE subscriptions 
         SET package_id = ?, package_name = ?, price = ?, updated_at = NOW() 
         WHERE customer_id = ? AND status = 'active'`, [newPackageId, newPackage.name, newPackage.price, customerId]);
            console.log(`Customer ${customerId} moved from PPPoE package to ${newPackage.name}`);
        }
        finally {
            conn.release();
        }
    }
    /**
     * Mengganti paket pelanggan tanpa validasi (force change)
     * Hanya digunakan oleh admin untuk kasus-kasus tertentu
     */
    static async forceChangePackage(customerId, newPackageId, packageType, adminId, reason) {
        try {
            // Log perubahan paket paksa
            await this.logForcePackageChange(customerId, newPackageId, adminId, reason);
            if (packageType === 'static_ip') {
                await (0, staticIpClientService_1.changeCustomerStaticIpPackage)(customerId, newPackageId);
            }
            else if (packageType === 'pppoe') {
                await this.changePppoePackage(customerId, newPackageId);
            }
            return {
                success: true,
                message: 'Perubahan paket dipaksakan berhasil dilakukan'
            };
        }
        catch (error) {
            console.error('[PackageChangeService] Error forcing package change:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan saat memaksa perubahan paket'
            };
        }
    }
    /**
     * Mencatat perubahan paket paksa ke log
     */
    static async logForcePackageChange(customerId, newPackageId, adminId, reason) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.execute(`INSERT INTO package_change_logs 
         (customer_id, old_package_id, new_package_id, admin_id, reason, change_type, created_at) 
         VALUES (?, (SELECT package_id FROM subscriptions WHERE customer_id = ? AND status = 'active' LIMIT 1), ?, ?, ?, 'forced', NOW())`, [customerId, customerId, newPackageId, adminId, reason]);
        }
        finally {
            conn.release();
        }
    }
    /**
     * Membuat log perubahan paket normal
     */
    static async logPackageChange(customerId, oldPackageId, newPackageId, adminId) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.execute(`INSERT INTO package_change_logs 
         (customer_id, old_package_id, new_package_id, admin_id, reason, change_type, created_at) 
         VALUES (?, ?, ?, ?, ?, 'normal', NOW())`, [customerId, oldPackageId, newPackageId, adminId, 'Normal package change']);
        }
        finally {
            conn.release();
        }
    }
}
exports.PackageChangeService = PackageChangeService;
//# sourceMappingURL=PackageChangeService.js.map