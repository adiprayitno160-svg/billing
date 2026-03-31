"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageChangeValidationService = void 0;
const pool_1 = require("../../db/pool");
/**
 * Service untuk validasi pembayaran sebelum perubahan paket
 */
class PackageChangeValidationService {
    /**
     * Memeriksa apakah pelanggan memiliki tagihan tertunggak
     * @param customerId ID pelanggan
     * @returns Informasi validasi dan daftar tagihan tertunggak jika ada
     */
    static async validateCustomerPaymentStatus(customerId) {
        try {
            // Query untuk mendapatkan tagihan tertunggak (status 'sent', 'partial', atau tanggal jatuh tempo belum lewat untuk 'overdue')
            const query = `
        SELECT 
          id,
          invoice_number,
          period,
          due_date,
          total_amount,
          remaining_amount,
          status
        FROM invoices 
        WHERE customer_id = ? 
          AND status IN ('sent', 'partial', 'overdue')
          AND remaining_amount > 0
        ORDER BY due_date ASC
      `;
            const [rows] = await pool_1.databasePool.query(query, [customerId]);
            const outstandingInvoices = rows;
            const totalOutstanding = outstandingInvoices.reduce((sum, invoice) => sum + invoice.remaining_amount, 0);
            if (outstandingInvoices.length > 0) {
                return {
                    isValid: false,
                    message: `Pelanggan memiliki ${outstandingInvoices.length} tagihan tertunggak dengan total Rp. ${totalOutstanding.toLocaleString('id-ID')}. Mohon selesaikan pembayaran terlebih dahulu sebelum mengganti paket.`,
                    outstandingInvoices: outstandingInvoices,
                    totalOutstandingAmount: totalOutstanding
                };
            }
            return {
                isValid: true,
                message: 'Tidak ada tagihan tertunggak. Pelanggan dapat mengganti paket.'
            };
        }
        catch (error) {
            console.error('Error validating customer payment status:', error);
            return {
                isValid: false,
                message: 'Terjadi kesalahan saat memvalidasi status pembayaran pelanggan.'
            };
        }
    }
    /**
     * Mendapatkan semua tagihan tertunggak untuk pelanggan
     * @param customerId ID pelanggan
     * @returns Daftar tagihan tertunggak
     */
    static async getOutstandingInvoices(customerId) {
        const query = `
      SELECT 
        id,
        invoice_number,
        period,
        due_date,
        total_amount,
        remaining_amount,
        status
      FROM invoices 
      WHERE customer_id = ? 
        AND status IN ('sent', 'partial', 'overdue')
        AND remaining_amount > 0
      ORDER BY due_date ASC
    `;
        const [rows] = await pool_1.databasePool.query(query, [customerId]);
        return rows;
    }
    /**
     * Memeriksa apakah pelanggan postpaid
     * @param customerId ID pelanggan
     * @returns true jika pelanggan postpaid
     */
    static async isPostpaidCustomer(customerId) {
        const query = 'SELECT billing_mode FROM customers WHERE id = ?';
        const [rows] = await pool_1.databasePool.query(query, [customerId]);
        if (rows.length === 0) {
            return false;
        }
        const customer = rows[0];
        return customer.billing_mode === 'postpaid';
    }
    /**
     * Validasi lengkap sebelum perubahan paket
     * @param customerId ID pelanggan
     * @returns Hasil validasi lengkap
     */
    static async validatePackageChangeEligibility(customerId) {
        // Cek apakah pelanggan postpaid
        const isPostpaid = await this.isPostpaidCustomer(customerId);
        if (!isPostpaid) {
            return {
                isValid: true,
                message: 'Pelanggan prabayar tidak perlu validasi pembayaran sebelum perubahan paket.'
            };
        }
        // Validasi tagihan tertunggak
        return await this.validateCustomerPaymentStatus(customerId);
    }
}
exports.PackageChangeValidationService = PackageChangeValidationService;
//# sourceMappingURL=PackageChangeValidationService.js.map