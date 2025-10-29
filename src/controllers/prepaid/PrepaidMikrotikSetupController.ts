import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { RouterOSAPI } from 'node-routeros';

/**
 * Controller untuk One-Click Mikrotik Setup
 * Admin tinggal klik tombol, sistem auto-setup semuanya!
 */
class PrepaidMikrotikSetupController {
  constructor() {
    // Bind methods to preserve 'this' context
    this.showSetupWizard = this.showSetupWizard.bind(this);
    this.setupMikrotik = this.setupMikrotik.bind(this);
    this.testConnection = this.testConnection.bind(this);
    this.resetSetup = this.resetSetup.bind(this);
  }

  /**
   * Show setup wizard page
   */
  async showSetupWizard(req: Request, res: Response) {
    try {
      // Ensure system_settings table exists
      await this.ensureSystemSettingsTable();

      // Auto-fix mikrotik_settings table (add is_active if not exists)
      await this.autoFixMikrotikSettingsTable();

      // Get Portal URL from system settings
      let portalUrl = '';
      try {
        const [portalSettings] = await pool.query<RowDataPacket[]>(
          "SELECT setting_value FROM system_settings WHERE setting_key = 'prepaid_portal_url'"
        );
        portalUrl = portalSettings.length > 0 ? portalSettings[0].setting_value : '';
      } catch (err) {
        console.warn('Failed to get portal URL:', err);
        portalUrl = '';
      }

      // Get Mikrotik settings
      let mikrotikSettings: any[] = [];
      let mikrotikConfigured = false;
      let setupStatus = {
        profiles: false,
        natRules: false,
        filterRules: false,
        ready: false
      };

      try {
        // Try to get active mikrotik settings
        const [settings] = await pool.query<RowDataPacket[]>(
          'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
        );
        
        console.log('[MikrotikSetup] Query result:', settings);
        
        mikrotikSettings = settings as any[];
        mikrotikConfigured = mikrotikSettings.length > 0;

        // If not found with is_active=1, try without filter
        if (!mikrotikConfigured) {
          console.log('[MikrotikSetup] No active settings, trying any settings...');
          const [anySettings] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM mikrotik_settings LIMIT 1'
          );
          mikrotikSettings = anySettings as any[];
          mikrotikConfigured = mikrotikSettings.length > 0;
          console.log('[MikrotikSetup] Found settings (any):', mikrotikConfigured);
        }

        // Check setup status only if mikrotik configured
        if (mikrotikConfigured) {
          console.log('[MikrotikSetup] Checking setup status for:', mikrotikSettings[0].host);
          try {
            setupStatus = await this.checkSetupStatus(mikrotikSettings[0]);
            console.log('[MikrotikSetup] Setup status:', setupStatus);
          } catch (statusError) {
            console.error('[MikrotikSetup] Failed to check setup status:', statusError);
            // Use default setupStatus
          }
        } else {
          console.log('[MikrotikSetup] No mikrotik settings found in database');
        }
      } catch (settingsError) {
        console.error('[MikrotikSetup] Failed to get mikrotik settings:', settingsError);
        // Use default values
      }

      res.render('prepaid/mikrotik-setup', {
        title: 'Mikrotik Setup Wizard',
        currentPath: '/prepaid/mikrotik-setup',
        portalUrl,
        mikrotikConfigured,
        mikrotikSettings: mikrotikConfigured ? mikrotikSettings[0] : { host: '', username: '', api_port: 8728 },
        setupStatus,
        success: req.query.success || null,
        error: req.query.error || null
      });
    } catch (error) {
      console.error('Setup wizard error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        </head>
        <body class="bg-gray-100 flex items-center justify-center min-h-screen">
          <div class="bg-white p-8 rounded-lg shadow-lg max-w-md">
            <div class="text-red-500 text-5xl mb-4 text-center">⚠️</div>
            <h1 class="text-2xl font-bold text-gray-900 mb-4 text-center">Error Loading Setup Wizard</h1>
            <p class="text-gray-600 mb-4 text-center">${errorMessage}</p>
            <div class="bg-gray-50 p-4 rounded border border-gray-200 mb-4">
              <p class="text-sm text-gray-700"><strong>Possible solutions:</strong></p>
              <ul class="text-sm text-gray-600 list-disc list-inside mt-2">
                <li>Restart the server: <code class="bg-gray-200 px-2 py-1 rounded">pm2 restart billing-system</code></li>
                <li>Check database connection</li>
                <li>Check logs: <code class="bg-gray-200 px-2 py-1 rounded">pm2 logs</code></li>
              </ul>
            </div>
            <div class="flex gap-4">
              <a href="/prepaid/dashboard" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-center hover:bg-blue-700">Back to Dashboard</a>
              <a href="javascript:history.back()" class="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded text-center hover:bg-gray-300">Go Back</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  }

  /**
   * One-click setup Mikrotik
   */
  async setupMikrotik(req: Request, res: Response) {
    try {
      const { portal_url } = req.body;

      if (!portal_url) {
        return res.redirect('/prepaid/mikrotik-setup?error=Portal URL harus diisi');
      }

      // Save Portal URL to system settings
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value, category) 
         VALUES ('prepaid_portal_url', ?, 'prepaid')
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [portal_url, portal_url]
      );

      // Get Mikrotik settings
      const [mikrotikSettings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (mikrotikSettings.length === 0) {
        return res.redirect('/prepaid/mikrotik-setup?error=Mikrotik belum dikonfigurasi. Setup Mikrotik dulu di Settings > Mikrotik');
      }

      const settings = mikrotikSettings[0];

      // Parse Portal URL
      const urlParts = this.parsePortalUrl(portal_url);

      // Connect to Mikrotik
      const api = new RouterOSAPI({
        host: settings.host,
        port: settings.api_port || 8728,
        user: settings.username,
        password: settings.password,
        timeout: 15000
      });

      await api.connect();

      let results: string[] = [];

      // 1. Create PPPoE Profiles
      results.push('📝 Creating PPPoE Profiles...');
      await this.createPPPoEProfiles(api);
      results.push('✅ PPPoE Profiles created');

      // 2. Create NAT Rules
      results.push('📝 Creating NAT Redirect Rules...');
      await this.createNATRules(api, urlParts.ip, urlParts.port);
      results.push('✅ NAT Rules created');

      // 3. Create Filter Rules
      results.push('📝 Creating Firewall Filter Rules...');
      await this.createFilterRules(api, urlParts.ip);
      results.push('✅ Filter Rules created');

      api.close();

      // Log setup
      await pool.query(
        `INSERT INTO activity_logs (user_id, action, description, ip_address) 
         VALUES (?, 'PREPAID_MIKROTIK_SETUP', ?, ?)`,
        [req.session?.user?.id || 0, results.join('\n'), req.ip]
      );

      res.redirect('/prepaid/mikrotik-setup?success=Mikrotik berhasil di-setup! Semua rules sudah aktif.');
    } catch (error) {
      console.error('Setup Mikrotik error:', error);
      res.redirect(`/prepaid/mikrotik-setup?error=Setup gagal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test Mikrotik connection
   */
  async testConnection(req: Request, res: Response) {
    try {
      const [mikrotikSettings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (mikrotikSettings.length === 0) {
        return res.json({ success: false, message: 'Mikrotik belum dikonfigurasi' });
      }

      const settings = mikrotikSettings[0];

      const api = new RouterOSAPI({
        host: settings.host,
        port: settings.api_port || 8728,
        user: settings.username,
        password: settings.password,
        timeout: 10000
      });

      await api.connect();
      
      // Get system identity
      const identity = await api.write('/system/identity/print');
      
      api.close();

      res.json({ 
        success: true, 
        message: 'Koneksi berhasil!',
        identity: Array.isArray(identity) && identity[0] ? identity[0].name : 'Unknown'
      });
    } catch (error) {
      res.json({ 
        success: false, 
        message: `Koneksi gagal: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Reset/Remove all prepaid rules
   */
  async resetSetup(req: Request, res: Response) {
    try {
      const [mikrotikSettings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (mikrotikSettings.length === 0) {
        return res.redirect('/prepaid/mikrotik-setup?error=Mikrotik belum dikonfigurasi');
      }

      const settings = mikrotikSettings[0];

      const api = new RouterOSAPI({
        host: settings.host,
        port: settings.api_port || 8728,
        user: settings.username,
        password: settings.password,
        timeout: 15000
      });

      await api.connect();

      // Remove NAT rules
      const natRules = await api.write('/ip/firewall/nat/print', ['?comment~prepaid']);
      if (Array.isArray(natRules)) {
        for (const rule of natRules) {
          if (rule['.id']) {
            await api.write('/ip/firewall/nat/remove', [`=.id=${rule['.id']}`]);
          }
        }
      }

      // Remove filter rules
      const filterRules = await api.write('/ip/firewall/filter/print', ['?comment~prepaid']);
      if (Array.isArray(filterRules)) {
        for (const rule of filterRules) {
          if (rule['.id']) {
            await api.write('/ip/firewall/filter/remove', [`=.id=${rule['.id']}`]);
          }
        }
      }

      api.close();

      res.redirect('/prepaid/mikrotik-setup?success=Setup berhasil di-reset. Semua rules dihapus.');
    } catch (error) {
      console.error('Reset setup error:', error);
      res.redirect(`/prepaid/mikrotik-setup?error=Reset gagal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create PPPoE Profiles
   */
  private async createPPPoEProfiles(api: RouterOSAPI): Promise<void> {
    const profiles = [
      { 
        name: 'prepaid-no-package', 
        rateLimit: '128k/128k', 
        addressList: 'prepaid-no-package',
        comment: 'Prepaid without package - redirect to portal'
      },
      { 
        name: 'prepaid-10mbps', 
        rateLimit: '10M/10M', 
        addressList: 'prepaid-active',
        comment: 'Prepaid 10Mbps package'
      },
      { 
        name: 'prepaid-20mbps', 
        rateLimit: '20M/20M', 
        addressList: 'prepaid-active',
        comment: 'Prepaid 20Mbps package'
      },
      { 
        name: 'prepaid-50mbps', 
        rateLimit: '50M/50M', 
        addressList: 'prepaid-active',
        comment: 'Prepaid 50Mbps package'
      },
      { 
        name: 'prepaid-100mbps', 
        rateLimit: '100M/100M', 
        addressList: 'prepaid-active',
        comment: 'Prepaid 100Mbps package'
      }
    ];

    for (const profile of profiles) {
      try {
        // Check if exists
        const existing = await api.write('/ppp/profile/print', [`?name=${profile.name}`]);
        
        if (Array.isArray(existing) && existing.length > 0) {
          // Update existing
          await api.write('/ppp/profile/set', [
            `=.id=${existing[0]['.id']}`,
            `=rate-limit=${profile.rateLimit}`,
            `=address-list=${profile.addressList}`,
            `=comment=${profile.comment}`
          ]);
        } else {
          // Create new
          await api.write('/ppp/profile/add', [
            `=name=${profile.name}`,
            `=rate-limit=${profile.rateLimit}`,
            `=address-list=${profile.addressList}`,
            `=only-one=yes`,
            `=comment=${profile.comment}`
          ]);
        }
      } catch (error) {
        console.error(`Failed to create profile ${profile.name}:`, error);
      }
    }
  }

  /**
   * Create NAT Redirect Rules
   */
  private async createNATRules(api: RouterOSAPI, toAddress: string, toPort: number): Promise<void> {
    const rules = [
      {
        chain: 'dstnat',
        srcAddressList: 'prepaid-no-package',
        protocol: 'tcp',
        dstPort: '80',
        action: 'dst-nat',
        toAddresses: toAddress,
        toPorts: toPort.toString(),
        comment: 'Redirect prepaid HTTP to portal'
      },
      {
        chain: 'dstnat',
        srcAddressList: 'prepaid-no-package',
        protocol: 'tcp',
        dstPort: '443',
        action: 'dst-nat',
        toAddresses: toAddress,
        toPorts: toPort.toString(),
        comment: 'Redirect prepaid HTTPS to portal'
      }
    ];

    for (const rule of rules) {
      try {
        // Check if exists
        const existing = await api.write('/ip/firewall/nat/print', [
          `?chain=${rule.chain}`,
          `?src-address-list=${rule.srcAddressList}`,
          `?dst-port=${rule.dstPort}`
        ]);

        if (Array.isArray(existing) && existing.length > 0) {
          // Update existing
          await api.write('/ip/firewall/nat/set', [
            `=.id=${existing[0]['.id']}`,
            `=to-addresses=${rule.toAddresses}`,
            `=to-ports=${rule.toPorts}`,
            `=comment=${rule.comment}`
          ]);
        } else {
          // Create new
          await api.write('/ip/firewall/nat/add', [
            `=chain=${rule.chain}`,
            `=src-address-list=${rule.srcAddressList}`,
            `=protocol=${rule.protocol}`,
            `=dst-port=${rule.dstPort}`,
            `=action=${rule.action}`,
            `=to-addresses=${rule.toAddresses}`,
            `=to-ports=${rule.toPorts}`,
            `=comment=${rule.comment}`
          ]);
        }
      } catch (error) {
        console.error(`Failed to create NAT rule for port ${rule.dstPort}:`, error);
      }
    }
  }

  /**
   * Create Firewall Filter Rules
   */
  private async createFilterRules(api: RouterOSAPI, billingServerIp: string): Promise<void> {
    const rules = [
      {
        chain: 'forward',
        srcAddressList: 'prepaid-active',
        action: 'accept',
        comment: 'Allow internet for active prepaid',
        placeCheck: true
      },
      {
        chain: 'forward',
        srcAddressList: 'prepaid-no-package',
        protocol: 'udp',
        dstPort: '53',
        action: 'accept',
        comment: 'Allow DNS for prepaid no package',
        placeCheck: false
      },
      {
        chain: 'forward',
        srcAddressList: 'prepaid-no-package',
        dstAddress: billingServerIp,
        action: 'accept',
        comment: 'Allow access to billing portal',
        placeCheck: false
      },
      {
        chain: 'forward',
        srcAddressList: 'prepaid-no-package',
        action: 'drop',
        comment: 'Block internet for prepaid no package',
        placeCheck: false
      }
    ];

    for (const rule of rules) {
      try {
        // Build query params
        const queryParams = [`?chain=${rule.chain}`, `?src-address-list=${rule.srcAddressList}`];
        if (rule.dstPort) queryParams.push(`?dst-port=${rule.dstPort}`);
        if (rule.dstAddress) queryParams.push(`?dst-address=${rule.dstAddress}`);
        
        const existing = await api.write('/ip/firewall/filter/print', queryParams);

        if (!Array.isArray(existing) || existing.length === 0) {
          // Create new
          const params = [
            `=chain=${rule.chain}`,
            `=src-address-list=${rule.srcAddressList}`,
            `=action=${rule.action}`,
            `=comment=${rule.comment}`
          ];

          if (rule.protocol) params.push(`=protocol=${rule.protocol}`);
          if (rule.dstPort) params.push(`=dst-port=${rule.dstPort}`);
          if (rule.dstAddress) params.push(`=dst-address=${rule.dstAddress}`);
          if (rule.placeCheck) params.push('=place-before=0');

          await api.write('/ip/firewall/filter/add', params);
        }
      } catch (error) {
        console.error(`Failed to create filter rule:`, error);
      }
    }
  }

  /**
   * Parse Portal URL to get IP and port
   */
  private parsePortalUrl(url: string): { ip: string; port: number } {
    // Remove protocol
    let cleanUrl = url.replace(/^https?:\/\//, '');
    
    // Split by colon
    const parts = cleanUrl.split(':');
    
    let ip = parts[0];
    let port = 3000; // default

    if (parts.length > 1) {
      port = parseInt(parts[1], 10) || 3000;
    } else if (url.startsWith('https://')) {
      port = 443;
    } else if (url.startsWith('http://')) {
      port = 80;
    }

    return { ip, port };
  }

  /**
   * Ensure system_settings table exists and has required columns
   */
  private async ensureSystemSettingsTable(): Promise<void> {
    try {
      // Create table if not exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT,
          setting_description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_setting_key (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Check if category column exists
      const [categoryColumn] = await pool.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'system_settings' 
          AND COLUMN_NAME = 'category'
      `);

      const hasCategoryColumn = Array.isArray(categoryColumn) && categoryColumn.length > 0;

      // Insert default prepaid settings (with or without category)
      if (hasCategoryColumn) {
        await pool.query(`
          INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_description, category) VALUES
          ('prepaid_portal_url', 'http://localhost:3000', 'URL server billing untuk redirect prepaid portal', 'prepaid'),
          ('prepaid_portal_enabled', 'true', 'Enable/disable prepaid portal system', 'prepaid'),
          ('prepaid_redirect_splash_page', 'true', 'Redirect ke splash page atau langsung login', 'prepaid'),
          ('prepaid_auto_whatsapp_notification', 'true', 'Auto WhatsApp notification untuk prepaid', 'prepaid')
        `);
      } else {
        // Insert without category column (backward compatible)
        await pool.query(`
          INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_description) VALUES
          ('prepaid_portal_url', 'http://localhost:3000', 'URL server billing untuk redirect prepaid portal'),
          ('prepaid_portal_enabled', 'true', 'Enable/disable prepaid portal system'),
          ('prepaid_redirect_splash_page', 'true', 'Redirect ke splash page atau langsung login'),
          ('prepaid_auto_whatsapp_notification', 'true', 'Auto WhatsApp notification untuk prepaid')
        `);
      }

      console.log('✅ [AutoFix] System settings table OK!');
    } catch (error) {
      console.error('❌ [AutoFix] Error ensuring system_settings table:', error);
      // Non-critical, continue
    }
  }

  /**
   * Auto-fix mikrotik_settings table (add is_active column if not exists)
   */
  private async autoFixMikrotikSettingsTable(): Promise<void> {
    try {
      console.log('🔧 [AutoFix] Checking mikrotik_settings table...');

      // Check if is_active column exists
      const [columns] = await pool.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'mikrotik_settings' 
          AND COLUMN_NAME = 'is_active'
      `);

      if (!Array.isArray(columns) || columns.length === 0) {
        console.log('🔧 [AutoFix] Column is_active tidak ada, menambahkan...');
        
        // Add is_active column
        await pool.query(`
          ALTER TABLE mikrotik_settings 
          ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1
        `);
        
        console.log('✅ [AutoFix] Column is_active berhasil ditambahkan!');
      } else {
        console.log('✅ [AutoFix] Column is_active sudah ada');
      }

      // Update all records to active (just in case)
      const [updateResult] = await pool.query(`
        UPDATE mikrotik_settings 
        SET is_active = 1 
        WHERE is_active IS NULL OR is_active = 0
      `);
      
      const affectedRows = (updateResult as any).affectedRows;
      if (affectedRows > 0) {
        console.log(`✅ [AutoFix] ${affectedRows} records updated to active`);
      }

      console.log('✅ [AutoFix] Mikrotik settings table OK!');
    } catch (error) {
      console.error('❌ [AutoFix] Error fixing mikrotik_settings table:', error);
      // Non-critical, continue
    }
  }

  /**
   * Check current setup status (OPTIMIZED WITH FASTER TIMEOUT)
   */
  private async checkSetupStatus(mikrotikSettings: any): Promise<any> {
    if (!mikrotikSettings) {
      return {
        profiles: false,
        natRules: false,
        filterRules: false,
        ready: false
      };
    }

    try {
      const api = new RouterOSAPI({
        host: mikrotikSettings.host,
        port: mikrotikSettings.api_port || 8728,
        user: mikrotikSettings.username,
        password: mikrotikSettings.password,
        timeout: 3000 // 3 seconds (faster!)
      });

      await api.connect();

      // Check profiles
      const profiles = await api.write('/ppp/profile/print', ['?name=prepaid-no-package']);
      const hasProfiles = Array.isArray(profiles) && profiles.length > 0;

      // Check NAT rules
      const natRules = await api.write('/ip/firewall/nat/print', ['?comment~prepaid']);
      const hasNatRules = Array.isArray(natRules) && natRules.length >= 2;

      // Check filter rules
      const filterRules = await api.write('/ip/firewall/filter/print', ['?comment~prepaid']);
      const hasFilterRules = Array.isArray(filterRules) && filterRules.length >= 4;

      api.close();

      return {
        profiles: hasProfiles,
        natRules: hasNatRules,
        filterRules: hasFilterRules,
        ready: hasProfiles && hasNatRules && hasFilterRules
      };
    } catch (error) {
      console.error('Check setup status error:', error);
      return {
        profiles: false,
        natRules: false,
        filterRules: false,
        ready: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default new PrepaidMikrotikSetupController();

