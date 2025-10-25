import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import MikrotikService from '../mikrotik/MikrotikService';

/**
 * Service untuk auto-setup MikroTik configuration
 * Untuk portal redirect, address list, NAT rule, firewall
 */
class AutoMikrotikSetupService {
  
  /**
   * Ensure portal-redirect address list exists
   */
  async ensurePortalRedirectList(): Promise<boolean> {
    try {
      // 1. Check if list exists in database
      const [dbRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_address_lists WHERE purpose = ? AND is_active = 1',
        ['portal-redirect']
      );
      
      if (dbRows.length > 0) {
        console.log('✅ Portal redirect address list already exists in database');
        return true;
      }
      
      // 2. Create in database
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO mikrotik_address_lists 
         (list_name, description, purpose, auto_manage, is_active, created_at)
         VALUES ('portal-redirect', 'Auto redirect pelanggan prepaid ke portal', 'portal-redirect', 1, 1, NOW())`
      );
      
      console.log('✅ Portal redirect address list created in database with ID:', result.insertId);
      
      // 3. Try to create in MikroTik (optional, non-critical)
      try {
        // Get active MikroTik settings
        const [mtSettings] = await pool.query<RowDataPacket[]>(
          'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
        );
        
        if (mtSettings.length > 0) {
          const config = mtSettings[0];
          
          // Note: Actual MikroTik creation will be handled by sync process
          // For now, we just log it
          console.log('📝 MikroTik address list will be synced on next sync cycle');
        }
      } catch (mtError) {
        console.warn('⚠️ MikroTik creation skipped (non-critical):', mtError);
      }
      
      return true;
    } catch (error) {
      console.error('Error ensuring portal-redirect list:', error);
      return false;
    }
  }
  
  /**
   * Ensure NAT rule for portal redirect exists
   * This is informational only - actual NAT rule must be created manually on MikroTik
   */
  async ensurePortalRedirectNAT(): Promise<{ exists: boolean; instructions?: string }> {
    try {
      // Get portal server settings
      const [settingsRows] = await pool.query<RowDataPacket[]>(
        "SELECT setting_value FROM system_settings WHERE setting_key = 'portal_server_ip'"
      );
      
      const portalIP = settingsRows.length > 0 ? settingsRows[0].setting_value : 'SERVER_IP';
      
      const instructions = `
📋 INSTRUKSI SETUP NAT RULE DI MIKROTIK:

1. Buka MikroTik via Winbox/WebFig
2. Masuk ke IP → Firewall → NAT
3. Klik Add (+) untuk menambah rule baru

4. Tab General:
   - Chain: dstnat
   - Protocol: tcp
   - Dst. Port: 80
   - Src. Address List: portal-redirect
   
5. Tab Action:
   - Action: dst-nat
   - To Addresses: ${portalIP}
   - To Ports: 3001
   - Comment: Auto-redirect prepaid portal (HTTP)

6. OPTIONAL - Redirect HTTPS juga:
   Ulangi step 3-5 dengan:
   - Dst. Port: 443
   - Comment: Auto-redirect prepaid portal (HTTPS)

7. Tab Advanced (Optional):
   - Interface: pilih interface WAN/Internet

✅ Setelah setup, customer di address list "portal-redirect" 
   akan otomatis di-redirect ke portal prepaid.
`;
      
      return {
        exists: false,
        instructions: instructions.trim()
      };
    } catch (error) {
      console.error('Error getting NAT instructions:', error);
      return {
        exists: false,
        instructions: 'Error getting instructions'
      };
    }
  }
  
  /**
   * Ensure firewall rule to allow portal access
   * This is informational only - actual rule must be created manually
   */
  async ensurePortalFirewall(): Promise<{ exists: boolean; instructions?: string }> {
    try {
      const [settingsRows] = await pool.query<RowDataPacket[]>(
        "SELECT setting_value FROM system_settings WHERE setting_key = 'portal_server_ip'"
      );
      
      const portalIP = settingsRows.length > 0 ? settingsRows[0].setting_value : 'SERVER_IP';
      
      const instructions = `
📋 INSTRUKSI SETUP FIREWALL RULE DI MIKROTIK:

1. Buka MikroTik via Winbox/WebFig
2. Masuk ke IP → Firewall → Filter Rules
3. Klik Add (+) untuk menambah rule baru

4. Tab General:
   - Chain: forward
   - Src. Address List: portal-redirect
   - Dst. Address: ${portalIP}
   
5. Tab Action:
   - Action: accept
   - Comment: Allow access to prepaid portal

6. PENTING: 
   - Posisikan rule ini di ATAS rule drop/reject lainnya
   - Pastikan isolated customer tetap bisa akses portal server

✅ Setelah setup, customer di address list "portal-redirect" 
   bisa mengakses portal server untuk beli paket.
`;
      
      return {
        exists: false,
        instructions: instructions.trim()
      };
    } catch (error) {
      console.error('Error getting firewall instructions:', error);
      return {
        exists: false,
        instructions: 'Error getting instructions'
      };
    }
  }
  
  /**
   * Get complete setup instructions
   */
  async getCompleteSetupInstructions(): Promise<string> {
    const natInfo = await this.ensurePortalRedirectNAT();
    const firewallInfo = await this.ensurePortalFirewall();
    
    return `
════════════════════════════════════════════════════
  PANDUAN LENGKAP SETUP MIKROTIK PORTAL REDIRECT
════════════════════════════════════════════════════

${natInfo.instructions}

────────────────────────────────────────────────────

${firewallInfo.instructions}

────────────────────────────────────────────────────

💡 TIPS:
1. Address list "portal-redirect" akan otomatis dikelola oleh sistem
2. Sistem akan otomatis add/remove IP customer sesuai status paket
3. Pastikan portal server dapat diakses dari network MikroTik
4. Test dengan migrasi 1 customer dulu sebelum migrasi massal

📞 Jika ada masalah, hubungi support teknis.

════════════════════════════════════════════════════
`.trim();
  }
  
  /**
   * Validate MikroTik configuration for portal redirect
   */
  async validateConfiguration(): Promise<{
    valid: boolean;
    checks: {
      addressList: boolean;
      natRule: boolean;
      firewallRule: boolean;
    };
    messages: string[];
  }> {
    const checks = {
      addressList: false,
      natRule: false,
      firewallRule: false
    };
    const messages: string[] = [];
    
    try {
      // Check address list in database
      const [listRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_address_lists WHERE purpose = ? AND is_active = 1',
        ['portal-redirect']
      );
      
      if (listRows.length > 0) {
        checks.addressList = true;
        messages.push('✅ Address list "portal-redirect" exists in database');
      } else {
        messages.push('❌ Address list "portal-redirect" not found in database');
      }
      
      // NAT and Firewall rules must be checked manually on MikroTik
      messages.push('⚠️ NAT rule: Must be configured manually on MikroTik (see instructions)');
      messages.push('⚠️ Firewall rule: Must be configured manually on MikroTik (see instructions)');
      
    } catch (error) {
      messages.push(`❌ Error validating configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    const valid = checks.addressList; // At minimum, address list must exist
    
    return {
      valid,
      checks,
      messages
    };
  }
}

export default new AutoMikrotikSetupService();

