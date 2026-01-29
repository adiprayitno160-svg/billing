import { databasePool } from '../../db/pool';
import { PackageChangeValidationService } from './PackageChangeValidationService';
import { PackageChangeNotificationService } from '../whatsapp/PackageChangeNotificationService';
import { changeCustomerStaticIpPackage } from '../staticIpClientService';
import { RowDataPacket } from 'mysql2';

export class PackageChangeService {
  
  /**
   * Mengganti paket pelanggan dengan validasi pembayaran terlebih dahulu
   * @param customerId ID pelanggan
   * @param newPackageId ID paket baru
   * @param packageType Jenis paket ('static_ip' atau 'pppoe')
   * @returns Hasil perubahan paket
   */
  static async changePackageWithValidation(
    customerId: number, 
    newPackageId: number, 
    packageType: 'static_ip' | 'pppoe'
  ): Promise<{ success: boolean; message: string; requiresPayment?: boolean; invoiceNotificationSent?: boolean }> {
    try {
      // Validasi apakah pelanggan dapat mengganti paket
      const validation = await PackageChangeValidationService.validatePackageChangeEligibility(customerId);
      
      if (!validation.isValid) {
        // Kirim notifikasi WhatsApp tentang tagihan tertunggak
        const notificationResult = await PackageChangeNotificationService.sendOutstandingInvoiceNotification(customerId);
        
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
      } else if (packageType === 'pppoe') {
        await this.changePppoePackage(customerId, newPackageId);
      }
      
      return {
        success: true,
        message: 'Perubahan paket berhasil dilakukan'
      };
    } catch (error) {
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
  private static async changeStaticIpPackage(customerId: number, newPackageId: number): Promise<void> {
    // Panggil fungsi asli dari staticIpClientService
    await changeCustomerStaticIpPackage(customerId, newPackageId);
  }

  /**
   * Mengganti paket PPPoE dengan validasi
   */
  private static async changePppoePackage(customerId: number, newPackageId: number): Promise<void> {
    // Implementasi untuk perubahan paket PPPoE
    // Ini adalah langkah awal, nanti bisa dikembangkan lebih lanjut
    
    const conn = await databasePool.getConnection();
    try {
      // Dapatkan data pelanggan dan paket lama
      const [customerRows] = await conn.query<RowDataPacket[]>(
        `SELECT c.*, p.name as package_name, p.price as package_price
         FROM customers c
         LEFT JOIN pppoe_packages p ON c.pppoe_profile_id = p.profile_id
         WHERE c.id = ?`,
        [customerId]
      );

      if (!Array.isArray(customerRows) || customerRows.length === 0) {
        throw new Error('Pelanggan tidak ditemukan');
      }

      const customer = customerRows[0];

      // Dapatkan data paket baru
      const [newPackageRows] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM pppoe_packages WHERE id = ?',
        [newPackageId]
      );

      if (!Array.isArray(newPackageRows) || newPackageRows.length === 0) {
        throw new Error('Paket baru tidak ditemukan');
      }

      const newPackage = newPackageRows[0];

      // Update paket di database (koneksi ke tabel pelanggan)
      await conn.execute(
        'UPDATE customers SET pppoe_profile_id = ? WHERE id = ?',
        [newPackage.profile_id, customerId]
      );

      // Update subscription
      await conn.execute(
        `UPDATE subscriptions 
         SET package_id = ?, package_name = ?, price = ?, updated_at = NOW() 
         WHERE customer_id = ? AND status = 'active'`,
        [newPackageId, newPackage.name, newPackage.price, customerId]
      );

      console.log(`Customer ${customerId} moved from PPPoE package to ${newPackage.name}`);
    } finally {
      conn.release();
    }
  }

  /**
   * Mengganti paket pelanggan tanpa validasi (force change)
   * Hanya digunakan oleh admin untuk kasus-kasus tertentu
   */
  static async forceChangePackage(
    customerId: number,
    newPackageId: number,
    packageType: 'static_ip' | 'pppoe',
    adminId: number,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Log perubahan paket paksa
      await this.logForcePackageChange(customerId, newPackageId, adminId, reason);

      if (packageType === 'static_ip') {
        await changeCustomerStaticIpPackage(customerId, newPackageId);
      } else if (packageType === 'pppoe') {
        await this.changePppoePackage(customerId, newPackageId);
      }

      return {
        success: true,
        message: 'Perubahan paket dipaksakan berhasil dilakukan'
      };
    } catch (error) {
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
  private static async logForcePackageChange(
    customerId: number,
    newPackageId: number,
    adminId: number,
    reason: string
  ): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
      await conn.execute(
        `INSERT INTO package_change_logs 
         (customer_id, old_package_id, new_package_id, admin_id, reason, change_type, created_at) 
         VALUES (?, (SELECT package_id FROM subscriptions WHERE customer_id = ? AND status = 'active' LIMIT 1), ?, ?, ?, 'forced', NOW())`,
        [customerId, customerId, newPackageId, adminId, reason]
      );
    } finally {
      conn.release();
    }
  }

  /**
   * Membuat log perubahan paket normal
   */
  static async logPackageChange(
    customerId: number,
    oldPackageId: number,
    newPackageId: number,
    adminId: number
  ): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
      await conn.execute(
        `INSERT INTO package_change_logs 
         (customer_id, old_package_id, new_package_id, admin_id, reason, change_type, created_at) 
         VALUES (?, ?, ?, ?, ?, 'normal', NOW())`,
        [customerId, oldPackageId, newPackageId, adminId, 'Normal package change']
      );
    } finally {
      conn.release();
    }
  }
}