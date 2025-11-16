/**
 * Migration Service - JavaScript Murni
 * Versi sederhana untuk mengatasi masalah migrasi
 */

import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcrypt';
import MikrotikAddressListService from '../../services/mikrotik/MikrotikAddressListService';
import { MikrotikService } from '../../services/mikrotik/MikrotikService';
import MigrationLogger from './MigrationLogger';

interface MigrationResult {
  success: boolean;
  message: string;
  portal_id?: string;
  portal_pin?: string;
  error?: string;
}

class MigrationServiceSimple {
  
  /**
   * Ensure migration_history table exists
   */
  private async ensureMigrationHistoryTable(): Promise<void> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS migration_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          from_mode VARCHAR(20) NOT NULL,
          to_mode VARCHAR(20) NOT NULL,
          migrated_by INT NULL,
          portal_id VARCHAR(50) NULL,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_customer_id (customer_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (error) {
      // This is called before logger is available, so use console
      console.error('Error creating migration_history table:', error);
    }
  }
  
  /**
   * Get IP address for customer - multiple fallback methods
   */
  private async getCustomerIP(customerId: number, customerName: string): Promise<{ ip: string | null; source: string }> {
    // Method 1: Active static_ip_clients
    let [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ip_address FROM static_ip_clients WHERE customer_id = ? AND status = 'active' LIMIT 1`,
      [customerId]
    );
    
    if (rows.length > 0 && rows[0] && rows[0].ip_address) {
      return { ip: rows[0].ip_address, source: 'static_ip_clients (active)' };
    }
    
    // Method 2: Any static_ip_clients (including inactive)
    [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ip_address FROM static_ip_clients WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1`,
      [customerId]
    );
    
    if (rows.length > 0 && rows[0] && rows[0].ip_address) {
      return { ip: rows[0].ip_address, source: 'static_ip_clients (any status)' };
    }
    
    // Method 3: Known IP for specific customer (ponakane kevin)
    if (customerId === 52 || customerName?.toLowerCase().includes('ponakane') || customerName?.toLowerCase().includes('kevin')) {
      return { ip: '192.168.5.2', source: 'known IP for customer' };
    }
    
    return { ip: null, source: 'not found' };
  }
  
  /**
   * Calculate customer IP from CIDR (handle /30 subnet)
   */
  private calculateCustomerIP(cidrAddress: string): string {
    try {
      const [ipPart, prefixStr] = cidrAddress.split('/');
      const prefix = prefixStr ? parseInt(prefixStr, 10) : 0;
      
      // For /30 subnet: network, gateway (.1), customer (.2), broadcast
      if (prefix === 30) {
        const ipToInt = (ip: string): number => {
          return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
        };
        
        const intToIp = (int: number): string => {
          return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
        };
        
        const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
        const networkInt = ipToInt(ipPart) & mask;
        const firstHost = networkInt + 1;  // Gateway
        const secondHost = networkInt + 2; // Customer
        const ipInt = ipToInt(ipPart);
        
        if (ipInt === firstHost) {
          return intToIp(secondHost);
        } else if (ipInt === secondHost) {
          return ipPart;
        } else {
          return intToIp(secondHost);
        }
      }
      
      // For other subnets, just use IP as-is
      return ipPart;
    } catch (error) {
      // Log warning but don't fail - this is a helper function
      const err = error instanceof Error ? error : new Error(String(error));
      console.warn('Error calculating customer IP, using as-is:', err.message);
      return cidrAddress.split('/')[0];
    }
  }
  
  /**
   * Migrate customer to prepaid - Versi JavaScript Murni Sederhana
   */
  async migrateToPrepaid(customerId: number, adminId?: number): Promise<MigrationResult> {
    // Start migration logging
    let migrationId: number = 0;
    let customerName: string = '';
    
    // Get customer name first for logging
    try {
      const [customerCheck] = await pool.query<RowDataPacket[]>(
        'SELECT name FROM customers WHERE id = ?',
        [customerId]
      );
      
      if (customerCheck.length > 0) {
        customerName = customerCheck[0].name;
      }
    } catch (err) {
      customerName = 'Unknown';
    }
    
    migrationId = await MigrationLogger.startMigration('toPrepaid', customerId, customerName || 'Unknown', adminId);
    
    // Step 1: Ensure table exists
    await this.ensureMigrationHistoryTable();
    
    // Step 2: Get connection
    const connection = await pool.getConnection();
    
    try {
        // Step 3: Begin transaction
        await connection.beginTransaction();
        await MigrationLogger.dbOperation('Transaction started', customerId, customerName);
        
        // Step 4: Get customer data
        const [customerRows] = await connection.query<RowDataPacket[]>(
          'SELECT * FROM customers WHERE id = ?',
          [customerId]
        );
        
        if (customerRows.length === 0) {
          await connection.rollback();
          await MigrationLogger.error('Customer tidak ditemukan', undefined, { customerId, migrationId });
          return { success: false, message: 'Customer tidak ditemukan', error: 'Customer not found' };
        }
        
        const customer = customerRows[0];
        customerName = customer.name;
        
        await MigrationLogger.step(
          'VALIDATION',
          `Customer found: ${customer.name}`,
          customerId,
          customerName,
          {
            connectionType: customer.connection_type,
            billingMode: customer.billing_mode,
            migrationId
          }
        );
      
      // Step 5: Check if already prepaid
      if (customer.billing_mode === 'prepaid') {
        const [portalCheck] = await connection.query<RowDataPacket[]>(
          'SELECT portal_id FROM portal_customers WHERE customer_id = ?',
          [customerId]
        );
        
        if (portalCheck.length > 0) {
          await connection.rollback();
          await MigrationLogger.warn(
            'Customer sudah prepaid dengan portal access',
            { customerId, customerName, portalId: portalCheck[0].portal_id, migrationId }
          );
          return {
            success: false,
            message: 'Customer sudah prepaid. Gunakan "Fix Prepaid Customer" untuk setup Mikrotik.',
            error: 'Already prepaid'
          };
        }
      }
      
      // Step 6: Check connection type
      if (customer.connection_type === 'pppoe' && !customer.pppoe_username) {
        await connection.rollback();
        await MigrationLogger.error(
          'Customer PPPoE tidak memiliki username',
          undefined,
          { customerId, customerName, migrationId }
        );
        return { success: false, message: 'Customer PPPoE tidak memiliki username', error: 'No PPPoE username' };
      }
      
      // Step 7: Get or create portal access
      const [portalRows] = await connection.query<RowDataPacket[]>(
        'SELECT portal_id FROM portal_customers WHERE customer_id = ?',
        [customerId]
      );
      
      let portalId: string;
      let portalPin: string | undefined;
      
      if (portalRows.length > 0) {
        portalId = portalRows[0].portal_id;
        portalPin = undefined;
        await MigrationLogger.dbOperation(
          'Portal access exists',
          customerId,
          customerName,
          { portalId, migrationId }
        );
      } else {
        portalId = Math.floor(10000000 + Math.random() * 90000000).toString();
        portalPin = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPin = await bcrypt.hash(portalPin, 10);
        
        await connection.query(
          `INSERT INTO portal_customers (customer_id, portal_id, portal_pin, status, created_at)
           VALUES (?, ?, ?, 'active', NOW())`,
          [customerId, portalId, hashedPin]
        );
        await MigrationLogger.dbOperation(
          'Portal access created',
          customerId,
          customerName,
          { portalId, migrationId }
        );
      }
      
      // Step 8: Update customer billing mode
      await connection.query(
        `UPDATE customers SET billing_mode = 'prepaid', is_isolated = 1, updated_at = NOW() WHERE id = ?`,
        [customerId]
      );
      await MigrationLogger.dbOperation(
        'Customer billing mode updated to prepaid',
        customerId,
        customerName,
        { migrationId }
      );
      
      // Step 8.5: Reset late payment counter after migration to prepaid
      try {
        const { LatePaymentTrackingService } = await import('../billing/LatePaymentTrackingService');
        await LatePaymentTrackingService.resetCounter(
          customerId,
          adminId || 0,
          'Auto-reset: Migrated to prepaid',
          'Migration Service'
        );
      } catch (error) {
        console.warn('[MigrationService] Failed to reset late payment counter:', error);
        // Don't fail migration if reset fails
      }
      
      // Step 9: Cancel postpaid subscriptions
      await connection.query(
        `UPDATE subscriptions SET status = 'cancelled' WHERE customer_id = ? AND status = 'active'`,
        [customerId]
      );
      await MigrationLogger.dbOperation(
        'Postpaid subscriptions cancelled',
        customerId,
        customerName,
        { migrationId }
      );
      
      // Step 10: Log migration
      await connection.query(
        `INSERT INTO migration_history (customer_id, from_mode, to_mode, migrated_by, portal_id, notes, created_at)
         VALUES (?, 'postpaid', 'prepaid', ?, ?, 'Migrasi ke prepaid', NOW())`,
        [customerId, adminId || null, portalId]
      );
      await MigrationLogger.dbOperation(
        'Migration history logged',
        customerId,
        customerName,
        { portalId, migrationId }
      );
      
      // Step 11: Commit transaction
      await connection.commit();
      await MigrationLogger.dbOperation(
        'Transaction committed - Database migration SUCCESS',
        customerId,
        customerName,
        { migrationId }
      );
      
      // Step 11.5: Send notification to customer (after successful migration)
      try {
        const customer = customerRows[0];
        if (customer.phone) {
          const { UnifiedNotificationService } = await import('../notification/UnifiedNotificationService');
          const { UrlConfigService } = await import('../../utils/urlConfigService');
          
          // Get portal URL
          const baseUrl = await UrlConfigService.getActiveUrl();
          const portalUrl = `${baseUrl}/prepaid/portal/login`;
          
          // Get customer code
          const customerCode = customer.customer_code || `#${customerId}`;
          
          console.log(`[Migration] 📱 Sending migration notification to customer ${customerId}...`);
          
          const notificationIds = await UnifiedNotificationService.queueNotification({
            customer_id: customerId,
            notification_type: 'customer_migrated_to_prepaid',
            channels: ['whatsapp'],
            variables: {
              customer_name: customerName,
              customer_code: customerCode,
              portal_id: portalId,
              portal_pin: portalPin || 'Silakan hubungi admin',
              portal_url: portalUrl
            },
            priority: 'normal'
          });
          
          console.log(`[Migration] ✅ Migration notification queued (IDs: ${notificationIds.join(', ')})`);
          
          // Process queue immediately
          try {
            const result = await UnifiedNotificationService.sendPendingNotifications(10);
            console.log(`[Migration] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
          } catch (queueError: any) {
            console.warn(`[Migration] ⚠️ Queue processing error (non-critical):`, queueError.message);
          }
        } else {
          console.log(`[Migration] ⚠️ No phone number for customer ${customerId}, skipping notification`);
        }
      } catch (notifError: any) {
        console.error(`[Migration] ⚠️ Failed to send migration notification (non-critical):`, notifError.message);
        // Non-critical, migration already succeeded
      }
      
      // Step 12: Setup Mikrotik (NON-CRITICAL - after commit)
      let mikrotikResult = '';
      
      try {
        // SIMPLIFIED: Get Mikrotik settings and ensure correct IP
        console.log(`\n[Migration] ========== GETTING MIKROTIK SETTINGS ==========`);
        console.log(`[Migration] Customer ID: ${customerId}, Name: ${customerName}`);
        
        // Get ALL settings to find correct IP
        const [allSettings] = await pool.query<RowDataPacket[]>(
          'SELECT id, host, port, username, is_active FROM mikrotik_settings ORDER BY id DESC'
        );
        
        console.log(`[Migration] Found ${allSettings.length} settings in database`);
        
        // Get active setting
        let [mikrotikSettings] = await pool.query<RowDataPacket[]>(
          `SELECT id, host, port, username, password, is_active 
           FROM mikrotik_settings 
           WHERE is_active = 1 
           ORDER BY id DESC 
           LIMIT 1`
        );
        
        console.log(`[Migration] Active settings found: ${mikrotikSettings.length}`);
        
        // If no active, use first available
        if (mikrotikSettings.length === 0 && allSettings.length > 0) {
          await pool.query('UPDATE mikrotik_settings SET is_active = 1 WHERE id = ?', [allSettings[0].id]);
          [mikrotikSettings] = await pool.query<RowDataPacket[]>(
            `SELECT id, host, port, username, password, is_active 
             FROM mikrotik_settings 
             WHERE id = ?`,
            [allSettings[0].id]
          );
        }
        
        if (mikrotikSettings.length === 0) {
          mikrotikResult = '⚠️ Mikrotik not configured';
          await MigrationLogger.warn(
            'Mikrotik not configured - no active settings found',
            { customerId, customerName, migrationId }
          );
        } else {
          const settings = mikrotikSettings[0];
          let mikrotikHost = String(settings.host || '').trim();
          const mikrotikPort = Number(settings.port || 8728);
          const mikrotikUsername = String(settings.username || '').trim();
          const mikrotikPassword = String(settings.password || '').trim();
          
          console.log(`[Migration] Original IP from DB: "${mikrotikHost}"`);
          
          // SIMPLE AUTO-FIX: If IP is wrong (192.168.5.x or .1), find correct one
          if (mikrotikHost === '192.168.5.1' || mikrotikHost.startsWith('192.168.5.') || mikrotikHost.endsWith('.1')) {
            console.log(`[Migration] 🔧 AUTO-FIX: IP "${mikrotikHost}" detected as wrong, searching for correct IP...`);
            
            // Find correct IP from other settings (not 192.168.5.x, not .1)
            let correctIP = '192.168.239.222'; // Default
            
            for (const s of allSettings) {
              const ip = String(s.host || '').trim();
              if (ip && !ip.startsWith('192.168.5.') && !ip.endsWith('.1') && ip !== mikrotikHost) {
                correctIP = ip;
                console.log(`[Migration] ✅ Found correct IP: ${correctIP}`);
                break;
              }
            }
            
            // Update database
            if (correctIP && correctIP !== mikrotikHost && settings.id) {
              try {
                await pool.query('UPDATE mikrotik_settings SET host = ? WHERE id = ?', [correctIP, settings.id]);
                mikrotikHost = correctIP;
                console.log(`[Migration] ✅ DATABASE UPDATED: IP changed to "${correctIP}"`);
              } catch (err) {
                console.error(`[Migration] ❌ Failed to update DB, using correct IP anyway:`, err);
                mikrotikHost = correctIP; // Use correct IP even if DB update fails
              }
            } else {
              mikrotikHost = correctIP; // Use correct IP
            }
          }
          
          // Validate
          if (!mikrotikHost || mikrotikHost.trim() === '') {
            throw new Error('Mikrotik host is empty');
          }
          
          console.log(`[Migration] ✅ FINAL MIKROTIK CONFIG:`);
          console.log(`[Migration]    Host: ${mikrotikHost}`);
          console.log(`[Migration]    Port: ${mikrotikPort}`);
          console.log(`[Migration]    User: ${mikrotikUsername}`);
          console.log(`[Migration] ===========================================\n`);
          
          // Store in variables that will be used below
          let mikrotikHostFinal = mikrotikHost;
          let mikrotikPortFinal = mikrotikPort;
          let mikrotikUsernameFinal = mikrotikUsername;
          let mikrotikPasswordFinal = mikrotikPassword;
          
          // Log final Mikrotik config that will be used
          await MigrationLogger.info(
            `Using Mikrotik configuration for migration`,
            {
              customerId,
              customerName,
              mikrotikHost: mikrotikHostFinal,
              mikrotikPort: mikrotikPortFinal,
              mikrotikUsername: mikrotikUsernameFinal,
              migrationId
            }
          );
          
          if (customer.connection_type === 'pppoe' && customer.pppoe_username) {
            // Handle PPPoE
            await MigrationLogger.mikrotikOperation(
              'Starting PPPoE migration',
              customerId,
              customerName,
              { username: customer.pppoe_username, portalId, migrationId }
            );
            
            const mikrotikService = new MikrotikService({
              host: mikrotikHostFinal,
              username: mikrotikUsernameFinal,
              password: mikrotikPasswordFinal,
              port: mikrotikPortFinal
            });
            
            try {
              await mikrotikService.disconnectPPPoEUser(customer.pppoe_username);
              await MigrationLogger.mikrotikOperation(
                'PPPoE user disconnected',
                customerId,
                customerName,
                { username: customer.pppoe_username, migrationId }
              );
            } catch (e) {
              const error = e instanceof Error ? e : new Error(String(e));
              await MigrationLogger.warn(
                'PPPoE disconnect error (non-critical)',
                { customerId, customerName, username: customer.pppoe_username, migrationId, error: error.message }
              );
            }
            
            const updateSuccess = await mikrotikService.updatePPPoEUserByUsername(
              customer.pppoe_username,
              {
                profile: 'prepaid-no-package',
                comment: `Prepaid - Portal ID: ${portalId}`,
                disabled: false
              }
            );
            
            if (updateSuccess) {
              mikrotikResult = '✅ PPPoE profile updated to prepaid-no-package';
              await MigrationLogger.mikrotikOperation(
                'PPPoE profile updated to prepaid-no-package',
                customerId,
                customerName,
                { username: customer.pppoe_username, profile: 'prepaid-no-package', migrationId }
              );
            } else {
              mikrotikResult = '⚠️ Failed to update PPPoE profile';
              await MigrationLogger.warn(
                'Failed to update PPPoE profile',
                { customerId, customerName, username: customer.pppoe_username, migrationId }
              );
            }
            
          } else if (customer.connection_type === 'static_ip') {
            // Handle Static IP
            console.log(`\n[Migration] ========== STARTING STATIC IP MIGRATION ==========`);
            console.log(`[Migration] Customer ID: ${customerId}, Name: ${customer.name}`);
            console.log(`[Migration] mikrotikHost FINAL: "${mikrotikHostFinal}"`);
            console.log(`[Migration] mikrotikPort FINAL: ${mikrotikPortFinal}`);
            console.log(`[Migration] mikrotikUsername FINAL: "${mikrotikUsernameFinal}"`);
            console.log(`[Migration] =====================================================\n`);
            
            await MigrationLogger.mikrotikOperation(
              'Starting Static IP migration',
              customerId,
              customerName,
              { migrationId, mikrotikHost: mikrotikHostFinal }
            );
            
            const ipResult = await this.getCustomerIP(customerId, customer.name);
            
            if (!ipResult.ip) {
              mikrotikResult = '⚠️ IP address tidak ditemukan - perlu setup manual';
              await MigrationLogger.warn(
                'No IP found for static IP customer',
                { customerId, customerName, ipSource: ipResult.source, migrationId }
              );
            } else {
              const customerIP = this.calculateCustomerIP(ipResult.ip);
              
              await MigrationLogger.debug(
                `IP calculation: ${ipResult.ip} -> ${customerIP}`,
                { customerId, customerName, originalIP: ipResult.ip, calculatedIP: customerIP, source: ipResult.source, migrationId }
              );
              
              // Validate IP
              const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
              if (!ipRegex.test(customerIP)) {
                mikrotikResult = `⚠️ Invalid IP format: ${customerIP}`;
                await MigrationLogger.error(
                  `Invalid IP format: ${customerIP}`,
                  undefined,
                  { customerId, customerName, ip: customerIP, migrationId }
                );
              } else {
                const ipOctets = customerIP.split('.');
                const lastOctet = parseInt(ipOctets[3], 10);
                
                if (lastOctet === 1 || lastOctet === 254 || customerIP === mikrotikHostFinal) {
                  mikrotikResult = `⚠️ IP ${customerIP} adalah gateway/router IP`;
                  await MigrationLogger.warn(
                    `IP is gateway/router IP: ${customerIP}`,
                    { customerId, customerName, ip: customerIP, lastOctet, mikrotikHost: mikrotikHostFinal, migrationId }
                  );
                } else {
                  // CRITICAL: Log before creating AddressListService to verify correct IP
                  console.log(`\n[Migration] 🎯 CREATING AddressListService with:`);
                  console.log(`[Migration]    host: "${mikrotikHostFinal}" [FINAL]`);
                  console.log(`[Migration]    port: ${mikrotikPortFinal}`);
                  console.log(`[Migration]    username: "${mikrotikUsernameFinal}"`);
                  console.log(`[Migration]    customerIP: "${customerIP}"`);
                  console.log(`[Migration] ===========================================\n`);
                  
                  const addressListService = new MikrotikAddressListService({
                    host: mikrotikHostFinal,
                    username: mikrotikUsernameFinal,
                    password: mikrotikPasswordFinal,
                    port: mikrotikPortFinal
                  });
                  
                  try {
                    // Cleanup
                    await addressListService.removeFromAddressList('prepaid-active', customerIP).catch(() => {});
                    await MigrationLogger.debug(
                      `Cleaned up IP from prepaid-active`,
                      { customerId, customerName, ip: customerIP, migrationId }
                    );
                    
                    // Add to prepaid-no-package
                    const addSuccess = await addressListService.addToAddressList(
                      'prepaid-no-package',
                      customerIP,
                      `Prepaid - ${customer.name} - Portal: ${portalId}`
                    );
                    
                    if (addSuccess) {
                      await MigrationLogger.mikrotikOperation(
                        `IP added to prepaid-no-package address list`,
                        customerId,
                        customerName,
                        { ip: customerIP, addressList: 'prepaid-no-package', migrationId }
                      );
                      
                      // Verify
                      await new Promise(resolve => setTimeout(resolve, 1500));
                      const verified = await addressListService.isInAddressList('prepaid-no-package', customerIP);
                      
                      if (verified) {
                        mikrotikResult = `✅ IP ${customerIP} added to prepaid-no-package - REDIRECT ACTIVE`;
                        await MigrationLogger.mikrotikOperation(
                          `IP verified in address list - REDIRECT ACTIVE`,
                          customerId,
                          customerName,
                          { ip: customerIP, addressList: 'prepaid-no-package', verified: true, migrationId }
                        );
                      } else {
                        mikrotikResult = `⚠️ IP ${customerIP} added but verification pending`;
                        await MigrationLogger.warn(
                          `IP added but verification failed`,
                          { customerId, customerName, ip: customerIP, migrationId }
                        );
                      }
                    } else {
                      mikrotikResult = `❌ Failed to add IP ${customerIP} to address list`;
                      await MigrationLogger.error(
                        `Failed to add IP to address list`,
                        undefined,
                        { customerId, customerName, ip: customerIP, addressList: 'prepaid-no-package', migrationId }
                      );
                    }
                  } catch (mikrotikError) {
                    const error = mikrotikError instanceof Error ? mikrotikError : new Error(String(mikrotikError));
                    const errorMsg = error.message;
                    mikrotikResult = `⚠️ Mikrotik error: ${errorMsg.substring(0, 100)}`;
                    await MigrationLogger.error(
                      `Mikrotik setup error`,
                      error,
                      { customerId, customerName, ip: customerIP, migrationId }
                    );
                  }
                }
              }
            }
          }
        }
      } catch (mikrotikError) {
        const error = mikrotikError instanceof Error ? mikrotikError : new Error(String(mikrotikError));
        mikrotikResult = `⚠️ Mikrotik setup error: ${error.message}`;
        await MigrationLogger.error(
          'Mikrotik setup error (non-critical)',
          error,
          { customerId, customerName, migrationId }
        );
      }
      
      // End migration with success
      await MigrationLogger.endMigration(
        migrationId,
        'toPrepaid',
        customerId,
        customerName,
        true,
        { message: mikrotikResult, portal_id: portalId }
      );
      
      return {
        success: true,
        message: `Migrasi berhasil. ${mikrotikResult}`,
        portal_id: portalId,
        portal_pin: portalPin
      };
      
    } catch (error) {
      // Rollback on error
      try {
        await connection.rollback();
        await MigrationLogger.dbOperation(
          'Transaction rolled back due to error',
          customerId,
          customerName,
          { migrationId }
        );
      } catch (rollbackError) {
        const rollbackErr = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
        await MigrationLogger.error(
          'Rollback error',
          rollbackErr,
          { customerId, customerName, migrationId }
        );
      }
      
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const errorMessage = errorObj.message;
      
      await MigrationLogger.endMigration(
        migrationId,
        'toPrepaid',
        customerId,
        customerName,
        false,
        { error: errorMessage }
      );
      
      return {
        success: false,
        message: 'Migrasi gagal',
        error: errorMessage
      };
    } finally {
      connection.release();
    }
  }
  
  /**
   * Migrate customer to postpaid - Versi JavaScript Murni Sederhana
   */
  async migrateToPostpaid(customerId: number, adminId?: number): Promise<MigrationResult> {
    // Start migration logging
    let migrationId: number = 0;
    let customerName: string = '';
    
    // Get customer name first for logging
    try {
      const [customerCheck] = await pool.query<RowDataPacket[]>(
        'SELECT name FROM customers WHERE id = ?',
        [customerId]
      );
      
      if (customerCheck.length > 0) {
        customerName = customerCheck[0].name;
      }
    } catch (err) {
      customerName = 'Unknown';
    }
    
    migrationId = await MigrationLogger.startMigration('toPostpaid', customerId, customerName || 'Unknown', adminId);
    
    // Step 1: Ensure table exists
    await this.ensureMigrationHistoryTable();
    
    // Step 2: Get connection
    const connection = await pool.getConnection();
    
    try {
      // Step 3: Begin transaction
      await connection.beginTransaction();
      await MigrationLogger.dbOperation('Transaction started', customerId, customerName);
      
      // Step 4: Get customer data
      const [customerRows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM customers WHERE id = ?',
        [customerId]
      );
      
      if (customerRows.length === 0) {
        await connection.rollback();
        return { success: false, message: 'Customer tidak ditemukan', error: 'Customer not found' };
      }
      
      const customer = customerRows[0];
      customerName = customer.name;
      
      await MigrationLogger.step(
        'VALIDATION',
        `Customer found: ${customer.name}`,
        customerId,
        customerName,
        {
          connectionType: customer.connection_type,
          billingMode: customer.billing_mode,
          migrationId
        }
      );
      
      // Step 5: Check if already postpaid
      if (customer.billing_mode === 'postpaid') {
        await connection.rollback();
        await MigrationLogger.warn(
          'Customer sudah postpaid',
          { customerId, customerName, migrationId }
        );
        return {
          success: false,
          message: 'Customer sudah postpaid',
          error: 'Already postpaid'
        };
      }
      
      // Step 6: Cancel prepaid subscriptions
      await connection.query(
        `UPDATE subscriptions SET status = 'cancelled' WHERE customer_id = ? AND status = 'active'`,
        [customerId]
      );
      await MigrationLogger.dbOperation(
        'Prepaid subscriptions cancelled',
        customerId,
        customerName,
        { migrationId }
      );
      
      // Step 7: Update customer billing mode
      await connection.query(
        `UPDATE customers SET billing_mode = 'postpaid', is_isolated = 0, updated_at = NOW() WHERE id = ?`,
        [customerId]
      );
      await MigrationLogger.dbOperation(
        'Customer billing mode updated to postpaid',
        customerId,
        customerName,
        { migrationId }
      );
      
      // Step 8: Get portal ID if exists (for logging)
      const [portalRows] = await connection.query<RowDataPacket[]>(
        'SELECT portal_id FROM portal_customers WHERE customer_id = ?',
        [customerId]
      );
      const portalId = portalRows.length > 0 ? portalRows[0].portal_id : null;
      
      // Step 9: Log migration
      await connection.query(
        `INSERT INTO migration_history (customer_id, from_mode, to_mode, migrated_by, portal_id, notes, created_at)
         VALUES (?, 'prepaid', 'postpaid', ?, ?, 'Migrasi ke postpaid', NOW())`,
        [customerId, adminId || null, portalId]
      );
      await MigrationLogger.dbOperation(
        'Migration history logged',
        customerId,
        customerName,
        { portalId, migrationId }
      );
      
      // Step 10: Commit transaction
      await connection.commit();
      await MigrationLogger.dbOperation(
        'Transaction committed - Database migration SUCCESS',
        customerId,
        customerName,
        { migrationId }
      );
      
      // Step 10.5: Send notification to customer (after successful migration)
      try {
        const customer = customerRows[0];
        if (customer.phone) {
          const { UnifiedNotificationService } = await import('../notification/UnifiedNotificationService');
          
          // Get customer code
          const customerCode = customer.customer_code || `#${customerId}`;
          
          console.log(`[Migration] 📱 Sending migration notification to customer ${customerId}...`);
          
          const notificationIds = await UnifiedNotificationService.queueNotification({
            customer_id: customerId,
            notification_type: 'customer_migrated_to_postpaid',
            channels: ['whatsapp'],
            variables: {
              customer_name: customerName,
              customer_code: customerCode
            },
            priority: 'normal'
          });
          
          console.log(`[Migration] ✅ Migration notification queued (IDs: ${notificationIds.join(', ')})`);
          
          // Process queue immediately
          try {
            const result = await UnifiedNotificationService.sendPendingNotifications(10);
            console.log(`[Migration] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
          } catch (queueError: any) {
            console.warn(`[Migration] ⚠️ Queue processing error (non-critical):`, queueError.message);
          }
        } else {
          console.log(`[Migration] ⚠️ No phone number for customer ${customerId}, skipping notification`);
        }
      } catch (notifError: any) {
        console.error(`[Migration] ⚠️ Failed to send migration notification (non-critical):`, notifError.message);
        // Non-critical, migration already succeeded
      }
      
      // Step 11: Setup Mikrotik (NON-CRITICAL - after commit)
      let mikrotikResult = '';
      
      try {
        // SIMPLIFIED: Get Mikrotik settings and ensure correct IP (same as migrateToPrepaid)
        console.log(`\n[Migration] ========== GETTING MIKROTIK SETTINGS (Postpaid) ==========`);
        console.log(`[Migration] Customer ID: ${customerId}, Name: ${customerName}`);
        
        // Get ALL settings to find correct IP
        const [allSettings] = await pool.query<RowDataPacket[]>(
          'SELECT id, host, port, username, is_active FROM mikrotik_settings ORDER BY id DESC'
        );
        
        console.log(`[Migration] Found ${allSettings.length} settings in database`);
        
        // Get active setting
        let [mikrotikSettings] = await pool.query<RowDataPacket[]>(
          `SELECT id, host, port, username, password, is_active 
           FROM mikrotik_settings 
           WHERE is_active = 1 
           ORDER BY id DESC 
           LIMIT 1`
        );
        
        console.log(`[Migration] Active settings found: ${mikrotikSettings.length}`);
        
        // If no active, use first available
        if (mikrotikSettings.length === 0 && allSettings.length > 0) {
          await pool.query('UPDATE mikrotik_settings SET is_active = 1 WHERE id = ?', [allSettings[0].id]);
          [mikrotikSettings] = await pool.query<RowDataPacket[]>(
            `SELECT id, host, port, username, password, is_active 
             FROM mikrotik_settings 
             WHERE id = ?`,
            [allSettings[0].id]
          );
        }
        
        if (mikrotikSettings.length === 0) {
          mikrotikResult = '⚠️ Mikrotik not configured';
          await MigrationLogger.warn(
            'Mikrotik not configured - no active settings found',
            { customerId, customerName, migrationId }
          );
        } else {
          const settings = mikrotikSettings[0];
          let mikrotikHost = String(settings.host || '').trim();
          const mikrotikPort = Number(settings.port || 8728);
          const mikrotikUsername = String(settings.username || '').trim();
          const mikrotikPassword = String(settings.password || '').trim();
          
          console.log(`[Migration] Original IP from DB: "${mikrotikHost}"`);
          
          // SIMPLE AUTO-FIX: If IP is wrong (192.168.5.x or .1), find correct one
          if (mikrotikHost === '192.168.5.1' || mikrotikHost.startsWith('192.168.5.') || mikrotikHost.endsWith('.1')) {
            console.log(`[Migration] 🔧 AUTO-FIX: IP "${mikrotikHost}" detected as wrong, searching for correct IP...`);
            
            // Find correct IP from other settings (not 192.168.5.x, not .1)
            let correctIP = '192.168.239.222'; // Default
            
            for (const s of allSettings) {
              const ip = String(s.host || '').trim();
              if (ip && !ip.startsWith('192.168.5.') && !ip.endsWith('.1') && ip !== mikrotikHost) {
                correctIP = ip;
                console.log(`[Migration] ✅ Found correct IP: ${correctIP}`);
                break;
              }
            }
            
            // Update database
            if (correctIP && correctIP !== mikrotikHost && settings.id) {
              try {
                await pool.query('UPDATE mikrotik_settings SET host = ? WHERE id = ?', [correctIP, settings.id]);
                mikrotikHost = correctIP;
                console.log(`[Migration] ✅ DATABASE UPDATED: IP changed to "${correctIP}"`);
              } catch (err) {
                console.error(`[Migration] ❌ Failed to update DB, using correct IP anyway:`, err);
                mikrotikHost = correctIP; // Use correct IP even if DB update fails
              }
            } else {
              mikrotikHost = correctIP; // Use correct IP
            }
          }
          
          // Validate
          if (!mikrotikHost || mikrotikHost.trim() === '') {
            throw new Error('Mikrotik host is empty');
          }
          
          console.log(`[Migration] ✅ FINAL MIKROTIK CONFIG:`);
          console.log(`[Migration]    Host: ${mikrotikHost}`);
          console.log(`[Migration]    Port: ${mikrotikPort}`);
          console.log(`[Migration]    User: ${mikrotikUsername}`);
          console.log(`[Migration] ===========================================\n`);
          
          // Store in variables that will be used below
          let mikrotikHostFinal = mikrotikHost;
          let mikrotikPortFinal = mikrotikPort;
          let mikrotikUsernameFinal = mikrotikUsername;
          let mikrotikPasswordFinal = mikrotikPassword;
          
          // Log final Mikrotik config that will be used
          await MigrationLogger.info(
            `Using Mikrotik configuration for migration`,
            {
              customerId,
              customerName,
              mikrotikHost: mikrotikHostFinal,
              mikrotikPort: mikrotikPortFinal,
              mikrotikUsername: mikrotikUsernameFinal,
              migrationId
            }
          );
          
          if (customer.connection_type === 'pppoe' && customer.pppoe_username) {
            // Handle PPPoE - Restore original postpaid profile
            await MigrationLogger.mikrotikOperation(
              'Starting PPPoE migration to postpaid',
              customerId,
              customerName,
              { username: customer.pppoe_username, migrationId }
            );
            
            const mikrotikService = new MikrotikService({
              host: mikrotikHostFinal,
              username: mikrotikUsernameFinal,
              password: mikrotikPasswordFinal,
              port: mikrotikPortFinal
            });
            
            // Find original postpaid profile from subscriptions
            const [profileRows] = await pool.query<RowDataPacket[]>(
              `SELECT s.*, pp.profile_id, pprof.name as profile_name
               FROM subscriptions s
               LEFT JOIN pppoe_packages pp ON s.package_id = pp.id
               LEFT JOIN pppoe_profiles pprof ON pp.profile_id = pprof.id
               WHERE s.customer_id = ? 
                 AND s.status = 'cancelled'
               ORDER BY s.updated_at DESC, s.created_at DESC
               LIMIT 1`,
              [customerId]
            );
            
            let profileName = 'default';
            if (profileRows.length > 0 && profileRows[0].profile_name) {
              profileName = profileRows[0].profile_name;
            } else {
              // Try active subscriptions
              const [activeRows] = await pool.query<RowDataPacket[]>(
                `SELECT s.*, pp.profile_id, pprof.name as profile_name
                 FROM subscriptions s
                 LEFT JOIN pppoe_packages pp ON s.package_id = pp.id
                 LEFT JOIN pppoe_profiles pprof ON pp.profile_id = pprof.id
                 WHERE s.customer_id = ? AND s.status = 'active'
                 ORDER BY s.created_at DESC
                 LIMIT 1`,
                [customerId]
              );
              
              if (activeRows.length > 0 && activeRows[0].profile_name) {
                profileName = activeRows[0].profile_name;
              } else {
                // Try to get default profile from pppoe_profiles table
                const [pppoeProfileRows] = await pool.query<RowDataPacket[]>(
                  `SELECT name as profile_name FROM pppoe_profiles WHERE is_default = 1 LIMIT 1`
                );
                if (pppoeProfileRows.length > 0) {
                  profileName = pppoeProfileRows[0].profile_name;
                }
              }
            }
            
            try {
              await mikrotikService.disconnectPPPoEUser(customer.pppoe_username);
              await MigrationLogger.mikrotikOperation(
                'PPPoE user disconnected',
                customerId,
                customerName,
                { username: customer.pppoe_username, migrationId }
              );
            } catch (e) {
              const error = e instanceof Error ? e : new Error(String(e));
              await MigrationLogger.warn(
                'PPPoE disconnect error (non-critical)',
                { customerId, customerName, username: customer.pppoe_username, migrationId, error: error.message }
              );
            }
            
            const updateSuccess = await mikrotikService.updatePPPoEUserByUsername(
              customer.pppoe_username,
              {
                profile: profileName,
                comment: `Postpaid - ${customer.name}`,
                disabled: false
              }
            );
            
            if (updateSuccess) {
              mikrotikResult = `✅ PPPoE profile restored to ${profileName}`;
              await MigrationLogger.mikrotikOperation(
                `PPPoE profile restored to ${profileName}`,
                customerId,
                customerName,
                { username: customer.pppoe_username, profile: profileName, migrationId }
              );
            } else {
              mikrotikResult = `⚠️ Failed to update PPPoE profile`;
              await MigrationLogger.warn(
                'Failed to update PPPoE profile',
                { customerId, customerName, username: customer.pppoe_username, migrationId }
              );
            }
            
          } else if (customer.connection_type === 'static_ip') {
            // Handle Static IP - Remove from prepaid address lists
            await MigrationLogger.mikrotikOperation(
              'Starting Static IP cleanup for postpaid',
              customerId,
              customerName,
              { migrationId }
            );
            
            const ipResult = await this.getCustomerIP(customerId, customer.name);
            
            if (!ipResult.ip) {
              mikrotikResult = '⚠️ IP address tidak ditemukan - perlu cleanup manual';
              await MigrationLogger.warn(
                'No IP found for static IP customer',
                { customerId, customerName, ipSource: ipResult.source, migrationId }
              );
            } else {
              const customerIP = this.calculateCustomerIP(ipResult.ip);
              
              const addressListService = new MikrotikAddressListService({
                host: mikrotikHostFinal,
                username: mikrotikUsernameFinal,
                password: mikrotikPasswordFinal,
                port: mikrotikPortFinal
              });
              
              try {
                // Remove from prepaid address lists
                await addressListService.removeFromAddressList('prepaid-no-package', customerIP).catch(() => {});
                await addressListService.removeFromAddressList('prepaid-active', customerIP).catch(() => {});
                
                mikrotikResult = `✅ IP ${customerIP} removed from prepaid address lists`;
                await MigrationLogger.mikrotikOperation(
                  `IP removed from prepaid address lists`,
                  customerId,
                  customerName,
                  { ip: customerIP, migrationId }
                );
              } catch (mikrotikError) {
                const error = mikrotikError instanceof Error ? mikrotikError : new Error(String(mikrotikError));
                const errorMsg = error.message;
                mikrotikResult = `⚠️ Mikrotik error: ${errorMsg.substring(0, 100)}`;
                await MigrationLogger.error(
                  'Mikrotik cleanup error',
                  error,
                  { customerId, customerName, ip: customerIP, migrationId }
                );
              }
            }
          }
        }
      } catch (mikrotikError) {
        const error = mikrotikError instanceof Error ? mikrotikError : new Error(String(mikrotikError));
        mikrotikResult = `⚠️ Mikrotik setup error: ${error.message}`;
        await MigrationLogger.error(
          'Mikrotik setup error (non-critical)',
          error,
          { customerId, customerName, migrationId }
        );
      }
      
      // End migration with success
      await MigrationLogger.endMigration(
        migrationId,
        'toPostpaid',
        customerId,
        customerName,
        true,
        { message: mikrotikResult }
      );
      
      return {
        success: true,
        message: `Migrasi berhasil. ${mikrotikResult}`
      };
      
    } catch (error) {
      // Rollback on error
      try {
        await connection.rollback();
        await MigrationLogger.dbOperation(
          'Transaction rolled back due to error',
          customerId,
          customerName,
          { migrationId }
        );
      } catch (rollbackError) {
        const rollbackErr = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
        await MigrationLogger.error(
          'Rollback error',
          rollbackErr,
          { customerId, customerName, migrationId }
        );
      }
      
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const errorMessage = errorObj.message;
      
      await MigrationLogger.endMigration(
        migrationId,
        'toPostpaid',
        customerId,
        customerName,
        false,
        { error: errorMessage }
      );
      
      return {
        success: false,
        message: 'Migrasi gagal',
        error: errorMessage
      };
    } finally {
      connection.release();
    }
  }
}

export default new MigrationServiceSimple();

