import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcrypt';
import AddressListService from '../prepaid/AddressListService';
import AutoMikrotikSetupService from './AutoMikrotikSetupService';
import { MikrotikService } from '../mikrotik/MikrotikService';
import MikrotikAddressListService from '../mikrotik/MikrotikAddressListService';

interface MigrationResult {
  success: boolean;
  message: string;
  portal_id?: string;
  portal_pin?: string;
  error?: string;
}

/**
 * Service untuk handle migrasi customer antara postpaid dan prepaid
 */
class MigrationService {
  
  /**
   * Auto-create migration_history table if not exists
   */
  private async ensureMigrationHistoryTable(): Promise<void> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS migration_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          from_mode VARCHAR(20) NOT NULL COMMENT 'postpaid atau prepaid',
          to_mode VARCHAR(20) NOT NULL COMMENT 'postpaid atau prepaid',
          migrated_by INT NULL COMMENT 'ID admin yang melakukan migrasi',
          portal_id VARCHAR(50) NULL COMMENT 'Portal ID yang di-generate',
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_customer_id (customer_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (error) {
      console.error('Error creating migration_history table:', error);
      // Ignore error if table already exists
    }
  }
  
  /**
   * Migrasi customer dari Postpaid ke Prepaid
   */
  async migrateToPrepaid(customerId: number, adminId?: number): Promise<MigrationResult> {
    // Ensure migration_history table exists
    await this.ensureMigrationHistoryTable();
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. Validasi customer
      const [customerRows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM customers WHERE id = ?',
        [customerId]
      );
      
      if (customerRows.length === 0) {
        throw new Error('Customer tidak ditemukan');
      }
      
      const customer = customerRows[0];
      
      // Cek apakah customer postpaid
      if (customer.billing_mode === 'prepaid') {
        throw new Error('Customer sudah menggunakan sistem prepaid');
      }
      
      // 2. Check apakah sudah punya portal access
      const [portalRows] = await connection.query<RowDataPacket[]>(
        'SELECT portal_id FROM portal_customers WHERE customer_id = ?',
        [customerId]
      );
      
      let portalId: string;
      let portalPin: string;
      
      if (portalRows.length > 0) {
        // Sudah punya portal access, gunakan yang lama
        portalId = portalRows[0].portal_id;
        portalPin = 'EXISTING'; // Tidak bisa retrieve PIN lama (encrypted)
      } else {
        // Generate Portal ID dan PIN baru
        portalId = Math.floor(10000000 + Math.random() * 90000000).toString();
        portalPin = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPin = await bcrypt.hash(portalPin, 10);
        
        // Insert portal access
        await connection.query(
          `INSERT INTO portal_customers (customer_id, portal_id, portal_pin, status, created_at)
           VALUES (?, ?, ?, 'active', NOW())`,
          [customerId, portalId, hashedPin]
        );
      }
      
      // 3. Update customer billing mode
      await connection.query(
        `UPDATE customers 
         SET billing_mode = 'prepaid', 
             is_isolated = 1,
             updated_at = NOW()
         WHERE id = ?`,
        [customerId]
      );
      
      // 4. Nonaktifkan paket postpaid yang aktif (jika ada)
      await connection.query(
        `UPDATE subscriptions 
         SET status = 'cancelled'
         WHERE customer_id = ? AND status = 'active'`,
        [customerId]
      );
      
      // 5. Log migration history
      await connection.query(
        `INSERT INTO migration_history 
         (customer_id, from_mode, to_mode, migrated_by, portal_id, notes, created_at)
         VALUES (?, 'postpaid', 'prepaid', ?, ?, 'Migrasi dari sistem postpaid ke prepaid', NOW())`,
        [customerId, adminId || null, portalId]
      );
      
      await connection.commit();
      
      // 6. Setup MikroTik berdasarkan connection type
      let mikrotikMessage = '';
      try {
        // Get Mikrotik settings
        const [mikrotikSettings] = await connection.query<RowDataPacket[]>(
          'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
        );
        
        if (mikrotikSettings.length > 0) {
          const settings = mikrotikSettings[0];
          const mikrotikService = new MikrotikService({
            host: settings.host,
            username: settings.username,
            password: settings.password,
            port: settings.api_port || 8728
          });
          
          const addressListService = new MikrotikAddressListService({
            host: settings.host,
            username: settings.username,
            password: settings.password,
            port: settings.api_port || 8728
          });
          
          // Handle berdasarkan connection type
          if (customer.connection_type === 'pppoe' && customer.pppoe_username) {
            // ===== PPPOE: Update profile ke prepaid-no-package =====
            console.log(`🔄 PPPoE Migration: ${customer.pppoe_username}`);
            
            const updateSuccess = await mikrotikService.updatePPPoEUserByUsername(
              customer.pppoe_username,
              {
                profile: 'prepaid-no-package',
                comment: `Prepaid - Portal ID: ${portalId} - Waiting for package`
              }
            );
            
            if (updateSuccess) {
              // Disconnect untuk force reconnect dengan profile baru
              await mikrotikService.disconnectPPPoEUser(customer.pppoe_username);
              mikrotikMessage = `✅ PPPoE profile updated to 'prepaid-no-package' & disconnected`;
              console.log(`✅ PPPoE user ${customer.pppoe_username} migrated successfully`);
            } else {
              mikrotikMessage = `⚠️ Failed to update PPPoE profile (check manually)`;
            }
            
          } else if (customer.connection_type === 'static' && customer.ip_address) {
            // ===== STATIC IP: Add to address-list =====
            console.log(`🔄 Static IP Migration: ${customer.ip_address}`);
            
            const addSuccess = await addressListService.addToAddressList(
              'prepaid-no-package',
              customer.ip_address,
              `Prepaid - ${customer.name} - Portal ID: ${portalId}`
            );
            
            if (addSuccess) {
              mikrotikMessage = `✅ IP ${customer.ip_address} added to 'prepaid-no-package' list`;
              console.log(`✅ Static IP ${customer.ip_address} migrated successfully`);
            } else {
              mikrotikMessage = `⚠️ Failed to add IP to address-list (check manually)`;
            }
            
          } else {
            mikrotikMessage = `⚠️ No PPPoE username or IP address found`;
            console.warn(`⚠️ Customer ${customerId} has no pppoe_username or ip_address`);
          }
          
        } else {
          mikrotikMessage = '⚠️ Mikrotik not configured';
          console.warn('⚠️ No active Mikrotik settings found');
        }
        
      } catch (mikrotikError) {
        console.error('⚠️ MikroTik setup error (non-critical):', mikrotikError);
        mikrotikMessage = `⚠️ Mikrotik error: ${mikrotikError instanceof Error ? mikrotikError.message : 'Unknown'}`;
      }
      
      return {
        success: true,
        message: `Migrasi ke prepaid berhasil. ${mikrotikMessage}`,
        portal_id: portalId,
        portal_pin: portalRows.length > 0 ? undefined : portalPin // Hanya return PIN jika baru dibuat
      };
      
    } catch (error) {
      await connection.rollback();
      console.error('Migration to prepaid error:', error);
      return {
        success: false,
        message: 'Migrasi gagal',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      connection.release();
    }
  }
  
  /**
   * Migrasi customer dari Prepaid ke Postpaid
   */
  async migrateToPostpaid(customerId: number, adminId?: number): Promise<MigrationResult> {
    // Ensure migration_history table exists
    await this.ensureMigrationHistoryTable();
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. Validasi customer
      const [customerRows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM customers WHERE id = ?',
        [customerId]
      );
      
      if (customerRows.length === 0) {
        throw new Error('Customer tidak ditemukan');
      }
      
      const customer = customerRows[0];
      
      // Cek apakah customer prepaid
      if (customer.billing_mode !== 'prepaid') {
        throw new Error('Customer tidak menggunakan sistem prepaid');
      }
      
      // 2. Nonaktifkan subscription prepaid yang aktif
      await connection.query(
        `UPDATE prepaid_package_subscriptions 
         SET status = 'cancelled', 
             updated_at = NOW()
         WHERE customer_id = ? AND status = 'active'`,
        [customerId]
      );
      
      // 3. Update customer billing mode
      await connection.query(
        `UPDATE customers 
         SET billing_mode = 'postpaid', 
             is_isolated = 0,
             updated_at = NOW()
         WHERE id = ?`,
        [customerId]
      );
      
      // 4. Log migration history
      await connection.query(
        `INSERT INTO migration_history 
         (customer_id, from_mode, to_mode, migrated_by, notes, created_at)
         VALUES (?, 'prepaid', 'postpaid', ?, 'Migrasi dari sistem prepaid ke postpaid', NOW())`,
        [customerId, adminId || null]
      );
      
      await connection.commit();
      
      // 5. Remove dari portal-redirect list
      try {
        await AddressListService.removeFromPortalRedirect(customerId);
        console.log(`✅ Customer ${customerId} removed from portal-redirect list`);
      } catch (mikrotikError) {
        console.error('⚠️ MikroTik cleanup error (non-critical):', mikrotikError);
      }
      
      return {
        success: true,
        message: 'Migrasi ke postpaid berhasil'
      };
      
    } catch (error) {
      await connection.rollback();
      console.error('Migration to postpaid error:', error);
      return {
        success: false,
        message: 'Migrasi gagal',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get migration history for customer
   */
  async getMigrationHistory(customerId: number): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        mh.*,
        u.name as admin_name
       FROM migration_history mh
       LEFT JOIN users u ON mh.migrated_by = u.id
       WHERE mh.customer_id = ?
       ORDER BY mh.created_at DESC`,
      [customerId]
    );
    return rows;
  }
  
  /**
   * Get customers by billing mode
   */
  async getCustomersByBillingMode(billingMode: 'postpaid' | 'prepaid'): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        c.*,
        pc.portal_id,
        COUNT(DISTINCT CASE WHEN i.status IN ('sent', 'partial', 'overdue') THEN i.id END) as unpaid_invoices,
        SUM(CASE WHEN i.status IN ('sent', 'partial', 'overdue') THEN i.remaining_amount ELSE 0 END) as total_debt
       FROM customers c
       LEFT JOIN portal_customers pc ON c.id = pc.customer_id
       LEFT JOIN invoices i ON c.id = i.customer_id
       WHERE c.billing_mode = ?
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [billingMode]
    );
    return rows;
  }
  
  /**
   * Check if customer can be migrated
   */
  async canMigrate(customerId: number): Promise<{ canMigrate: boolean; reason?: string }> {
    const [customerRows] = await pool.query<RowDataPacket[]>(
      'SELECT billing_mode, status FROM customers WHERE id = ?',
      [customerId]
    );
    
    if (customerRows.length === 0) {
      return { canMigrate: false, reason: 'Customer tidak ditemukan' };
    }
    
    const customer = customerRows[0];
    
    if (customer.status !== 'active') {
      return { canMigrate: false, reason: 'Customer tidak aktif' };
    }
    
    return { canMigrate: true };
  }
}

export default new MigrationService();

