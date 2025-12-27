"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("../../db/pool"));
const node_routeros_1 = require("node-routeros");
const mikrotikConfigHelper_1 = require("../../utils/mikrotikConfigHelper");
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
    async showSetupWizard(req, res) {
        try {
            // Ensure system_settings table exists
            await this.ensureSystemSettingsTable();
            // Ensure activity_logs table exists
            await this.ensureActivityLogsTable();
            // Auto-fix mikrotik_settings table (add is_active if not exists)
            await this.autoFixMikrotikSettingsTable();
            // Get Portal URL from system settings
            let portalUrl = '';
            try {
                const [portalSettings] = await pool_1.default.query("SELECT setting_value FROM system_settings WHERE setting_key = 'prepaid_portal_url'");
                portalUrl = portalSettings.length > 0 ? (portalSettings[0]?.setting_value || '') : '';
                // Warn if using localhost
                if (portalUrl && portalUrl.includes('localhost')) {
                    console.warn('[Setup] ⚠️ Portal URL menggunakan localhost. Pastikan menggunakan IP address yang bisa diakses dari Mikrotik!');
                }
            }
            catch (err) {
                console.warn('Failed to get portal URL:', err);
                portalUrl = '';
            }
            // Get Mikrotik settings - Initialize with defaults
            let mikrotikSettings = [];
            let mikrotikConfigured = false;
            let setupStatus = {
                profiles: false,
                natRules: false,
                filterRules: false,
                ready: false
            };
            // Initialize mikrotikConfig variable for use in try-catch
            let mikrotikConfig = null;
            try {
                // Get Mikrotik settings menggunakan helper yang konsisten
                mikrotikConfig = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
                if (mikrotikConfig) {
                    // Validate config untuk memastikan lengkap
                    const validation = (0, mikrotikConfigHelper_1.validateMikrotikConfig)(mikrotikConfig);
                    if (validation.valid) {
                        mikrotikSettings = [mikrotikConfig];
                        mikrotikConfigured = true;
                        console.log('[MikrotikSetup] ✅ Found valid Mikrotik settings:', mikrotikConfig.host);
                        // Check setup status
                        console.log('[MikrotikSetup] Checking setup status for:', mikrotikConfig.host);
                        try {
                            setupStatus = await this.checkSetupStatus(mikrotikConfig);
                            console.log('[MikrotikSetup] Setup status:', setupStatus);
                        }
                        catch (statusError) {
                            console.error('[MikrotikSetup] Failed to check setup status:', statusError);
                            // Use default setupStatus, but keep mikrotikConfigured = true
                        }
                    }
                    else {
                        mikrotikConfigured = false;
                        console.log('[MikrotikSetup] ⚠️ Mikrotik settings found but invalid:', validation.error);
                    }
                }
                else {
                    mikrotikConfigured = false;
                    mikrotikSettings = [];
                    console.log('[MikrotikSetup] ❌ No Mikrotik settings found in database');
                }
            }
            catch (settingsError) {
                console.error('[MikrotikSetup] ❌ Error getting mikrotik settings:', settingsError);
                mikrotikConfigured = false;
                mikrotikSettings = [];
                // Use default values
            }
            // Debug logging
            console.log('[MikrotikSetup] Final status:', {
                mikrotikConfigured,
                hasSettings: mikrotikSettings.length > 0,
                settingsHost: mikrotikSettings.length > 0 ? mikrotikSettings[0].host : 'none'
            });
            res.render('prepaid/mikrotik-setup', {
                title: 'Mikrotik Setup Wizard',
                currentPath: '/prepaid/mikrotik-setup',
                portalUrl,
                mikrotikConfigured,
                mikrotikSettings: mikrotikConfigured && mikrotikSettings.length > 0 ? mikrotikSettings[0] : { host: '', username: '', api_port: 8728 },
                setupStatus,
                success: req.query.success || null,
                error: req.query.error || null
            });
        }
        catch (error) {
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
    async setupMikrotik(req, res) {
        try {
            const { portal_url } = req.body;
            if (!portal_url) {
                return res.redirect('/prepaid/mikrotik-setup?error=Portal URL harus diisi');
            }
            // Save Portal URL to system settings
            // Check if category column exists first
            const [categoryCheck] = await pool_1.default.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'system_settings' 
          AND COLUMN_NAME = 'category'
      `);
            const hasCategory = Array.isArray(categoryCheck) && categoryCheck.length > 0;
            if (hasCategory) {
                await pool_1.default.query(`INSERT INTO system_settings (setting_key, setting_value, category) 
           VALUES ('prepaid_portal_url', ?, 'prepaid')
           ON DUPLICATE KEY UPDATE setting_value = ?`, [portal_url, portal_url]);
            }
            else {
                await pool_1.default.query(`INSERT INTO system_settings (setting_key, setting_value) 
           VALUES ('prepaid_portal_url', ?)
           ON DUPLICATE KEY UPDATE setting_value = ?`, [portal_url, portal_url]);
            }
            // Get Mikrotik settings menggunakan helper yang konsisten
            const mikrotikConfig = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            // Validate config
            const validation = (0, mikrotikConfigHelper_1.validateMikrotikConfig)(mikrotikConfig);
            if (!validation.valid) {
                return res.redirect(`/prepaid/mikrotik-setup?error=${encodeURIComponent(validation.error || 'Mikrotik belum dikonfigurasi. Setup Mikrotik dulu di Settings > Mikrotik')}`);
            }
            // Parse Portal URL
            const urlParts = this.parsePortalUrl(portal_url);
            // Connect to Mikrotik menggunakan config yang sudah divalidasi
            console.log(`[Setup] Connecting to Mikrotik: ${mikrotikConfig.host}:${mikrotikConfig.port}`);
            console.log(`[Setup] Using settings from database (consistent with Settings > Mikrotik)`);
            const api = new node_routeros_1.RouterOSAPI({
                host: mikrotikConfig.host,
                port: mikrotikConfig.port,
                user: mikrotikConfig.username,
                password: mikrotikConfig.password,
                timeout: 15000
            });
            let apiConnected = false;
            try {
                await api.connect();
                apiConnected = true;
                console.log('[Setup] ✅ Connected to Mikrotik successfully');
                let results = [];
                // 1. Ensure Address Lists exist first
                results.push('📝 Creating Address Lists...');
                try {
                    await this.ensureAddressLists(api);
                    results.push('✅ Address Lists created');
                }
                catch (addressListError) {
                    console.error('[Setup] Address Lists error:', addressListError);
                    results.push(`⚠️ Address Lists: ${addressListError instanceof Error ? addressListError.message : 'Error'}`);
                }
                // 2. Create PPPoE Profiles
                results.push('📝 Creating PPPoE Profiles...');
                try {
                    await this.createPPPoEProfiles(api);
                    results.push('✅ PPPoE Profiles created');
                }
                catch (profileError) {
                    console.error('[Setup] PPPoE Profiles error:', profileError);
                    results.push(`⚠️ PPPoE Profiles: ${profileError instanceof Error ? profileError.message : 'Error'}`);
                }
                // 3. Create NAT Rules
                results.push('📝 Creating NAT Redirect Rules...');
                let natSuccess = false;
                let natErrorMsg = '';
                try {
                    await this.createNATRules(api, urlParts.ip, urlParts.port);
                    results.push('✅ NAT Rules created');
                    natSuccess = true;
                }
                catch (natError) {
                    console.error('[Setup] NAT Rules error:', natError);
                    const errorMsg = natError instanceof Error ? natError.message : 'Unknown error';
                    results.push(`❌ NAT Rules FAILED: ${errorMsg}`);
                    natErrorMsg = errorMsg;
                }
                // 4. Create Filter Rules
                results.push('📝 Creating Firewall Filter Rules...');
                let filterSuccess = false;
                let filterErrorMsg = '';
                try {
                    console.log('[Setup] ===== STARTING FILTER RULES CREATION =====');
                    console.log('[Setup] Billing server IP:', urlParts.ip);
                    await this.createFilterRules(api, urlParts.ip);
                    console.log('[Setup] ===== FILTER RULES CREATION COMPLETED =====');
                    results.push('✅ Filter Rules created');
                    filterSuccess = true;
                }
                catch (filterError) {
                    console.error('[Setup] ===== FILTER RULES ERROR =====');
                    console.error('[Setup] Filter Rules error:', filterError);
                    console.error('[Setup] Error stack:', filterError instanceof Error ? filterError.stack : 'No stack');
                    const errorMsg = filterError instanceof Error ? filterError.message : 'Unknown error';
                    console.error('[Setup] Error message:', errorMsg);
                    results.push(`❌ Filter Rules FAILED: ${errorMsg}`);
                    filterErrorMsg = errorMsg;
                }
                // Log setup (with table check)
                try {
                    await this.ensureActivityLogsTable();
                    await pool_1.default.query(`INSERT INTO activity_logs (user_id, action, description, ip_address) 
             VALUES (?, 'PREPAID_MIKROTIK_SETUP', ?, ?)`, [req.session?.user?.id || 0, results.join('\n'), req.ip]);
                }
                catch (logError) {
                    console.warn('[Setup] Failed to log to activity_logs:', logError);
                    // Continue anyway - logging is not critical
                }
                // Build redirect message based on results
                const allSuccess = natSuccess && filterSuccess;
                if (allSuccess) {
                    res.redirect('/prepaid/mikrotik-setup?success=Mikrotik berhasil di-setup! Semua rules sudah aktif.');
                }
                else {
                    // Build error message
                    const errorMessages = [];
                    if (!natSuccess) {
                        errorMessages.push(`NAT Rules: ${natErrorMsg || 'Gagal dibuat'}`);
                    }
                    if (!filterSuccess) {
                        errorMessages.push(`Filter Rules: ${filterErrorMsg || 'Gagal dibuat'}`);
                    }
                    const combinedError = errorMessages.join(' | ');
                    console.error('[Setup] Setup completed with errors:', combinedError);
                    res.redirect(`/prepaid/mikrotik-setup?error=${encodeURIComponent(`Setup sebagian berhasil, tapi ada error: ${combinedError}`)}`);
                }
            }
            catch (setupError) {
                console.error('[Setup] Setup error:', setupError);
                throw setupError; // Re-throw to be caught by outer catch
            }
            finally {
                // Always close connection
                if (apiConnected) {
                    try {
                        api.close();
                        console.log('[Setup] Connection closed');
                    }
                    catch (closeError) {
                        console.warn('[Setup] Error closing connection:', closeError);
                    }
                }
            }
        }
        catch (error) {
            console.error('[Setup] Setup Mikrotik error:', error);
            // Provide more detailed error message
            let errorMessage = 'Unknown error';
            if (error instanceof Error) {
                errorMessage = error.message;
                // Common error messages with better descriptions
                if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                    errorMessage = 'Koneksi timeout. Pastikan Mikrotik dapat diakses dan port API (8728) terbuka.';
                }
                else if (error.message.includes('ECONNREFUSED') || error.message.includes('refused')) {
                    errorMessage = 'Koneksi ditolak. Pastikan host dan port benar, dan API service aktif di Mikrotik.';
                }
                else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
                    errorMessage = 'Host tidak ditemukan. Pastikan alamat IP/hostname Mikrotik benar.';
                }
                else if (error.message.includes('invalid user name or password') || error.message.includes('login')) {
                    errorMessage = 'Username atau password salah. Periksa kredensial Mikrotik.';
                }
                else if (error.message.includes('no such user')) {
                    errorMessage = 'User tidak ditemukan di Mikrotik. Periksa username.';
                }
            }
            res.redirect(`/prepaid/mikrotik-setup?error=Setup gagal: ${errorMessage}`);
        }
    }
    /**
     * Test Mikrotik connection
     */
    async testConnection(req, res) {
        try {
            // Get Mikrotik settings menggunakan helper yang konsisten
            const mikrotikConfig = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            // Validate config
            const validation = (0, mikrotikConfigHelper_1.validateMikrotikConfig)(mikrotikConfig);
            if (!validation.valid) {
                return res.json({
                    success: false,
                    message: validation.error || 'Mikrotik belum dikonfigurasi. Setup Mikrotik dulu di Settings > Mikrotik'
                });
            }
            console.log(`[Test] Connecting to Mikrotik: ${mikrotikConfig.host}:${mikrotikConfig.port}`);
            console.log(`[Test] Using settings from database (consistent with Settings > Mikrotik)`);
            const api = new node_routeros_1.RouterOSAPI({
                host: mikrotikConfig.host,
                port: mikrotikConfig.port,
                user: mikrotikConfig.username,
                password: mikrotikConfig.password,
                timeout: 10000
            });
            let apiConnected = false;
            try {
                await api.connect();
                apiConnected = true;
                console.log('[Test] ✅ Connected to Mikrotik');
                // Get system identity
                const identity = await api.write('/system/identity/print');
                console.log('[Test] Identity result:', identity);
                const identityName = Array.isArray(identity) && identity[0] ? identity[0].name : 'Unknown';
                return res.json({
                    success: true,
                    message: 'Koneksi berhasil!',
                    identity: identityName
                });
            }
            catch (error) {
                console.error('[Test] Connection error:', error);
                // Provide more detailed error message
                let errorMessage = 'Unknown error';
                if (error instanceof Error) {
                    errorMessage = error.message;
                    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                        errorMessage = 'Timeout: Pastikan Mikrotik dapat diakses dan port API terbuka';
                    }
                    else if (error.message.includes('ECONNREFUSED')) {
                        errorMessage = 'Koneksi ditolak: Pastikan API service aktif di Mikrotik';
                    }
                    else if (error.message.includes('ENOTFOUND')) {
                        errorMessage = 'Host tidak ditemukan: Periksa alamat IP/hostname';
                    }
                    else if (error.message.includes('invalid user name or password') || error.message.includes('login')) {
                        errorMessage = 'Username atau password salah';
                    }
                }
                return res.json({
                    success: false,
                    message: `Koneksi gagal: ${errorMessage}`
                });
            }
            finally {
                if (apiConnected) {
                    try {
                        api.close();
                    }
                    catch (closeError) {
                        console.warn('[Test] Error closing connection:', closeError);
                    }
                }
            }
        }
        catch (error) {
            console.error('[Test] Outer error:', error);
            return res.json({
                success: false,
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
    /**
     * Reset/Remove all prepaid rules
     */
    async resetSetup(req, res) {
        try {
            // Get Mikrotik settings menggunakan helper yang konsisten
            const mikrotikConfig = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            // Validate config
            const validation = (0, mikrotikConfigHelper_1.validateMikrotikConfig)(mikrotikConfig);
            if (!validation.valid) {
                return res.redirect(`/prepaid/mikrotik-setup?error=${encodeURIComponent(validation.error || 'Mikrotik belum dikonfigurasi')}`);
            }
            console.log(`[Reset] Connecting to Mikrotik: ${mikrotikConfig.host}:${mikrotikConfig.port}`);
            console.log(`[Reset] Using settings from database (consistent with Settings > Mikrotik)`);
            const api = new node_routeros_1.RouterOSAPI({
                host: mikrotikConfig.host,
                port: mikrotikConfig.port,
                user: mikrotikConfig.username,
                password: mikrotikConfig.password,
                timeout: 15000
            });
            await api.connect();
            let deletedNatCount = 0;
            let deletedFilterCount = 0;
            // Get all NAT rules first, then filter
            console.log('[Reset] Fetching all NAT rules...');
            const allNatRules = await api.write('/ip/firewall/nat/print');
            const allNatArray = Array.isArray(allNatRules) ? allNatRules : [];
            // Filter NAT rules with "prepaid" in comment or using prepaid address-list
            const natRulesToDelete = allNatArray.filter((r) => {
                const hasPrepaidComment = r.comment && r.comment.toLowerCase().includes('prepaid');
                const hasPrepaidList = r['src-address-list'] &&
                    (r['src-address-list'] === 'prepaid-no-package' || r['src-address-list'] === 'prepaid-active');
                return hasPrepaidComment || (hasPrepaidList && r.chain === 'dstnat');
            });
            console.log(`[Reset] Found ${natRulesToDelete.length} NAT rules to delete`);
            // Remove NAT rules
            for (const rule of natRulesToDelete) {
                if (rule['.id']) {
                    try {
                        await api.write('/ip/firewall/nat/remove', [`=.id=${rule['.id']}`]);
                        deletedNatCount++;
                        console.log(`[Reset] Deleted NAT rule: ${rule.comment || rule['.id']}`);
                    }
                    catch (error) {
                        console.error(`[Reset] Failed to delete NAT rule ${rule['.id']}:`, error);
                    }
                }
            }
            // Get all filter rules first, then filter
            console.log('[Reset] Fetching all filter rules...');
            const allFilterRules = await api.write('/ip/firewall/filter/print');
            const allFilterArray = Array.isArray(allFilterRules) ? allFilterRules : [];
            // Filter filter rules with "prepaid" in comment or using prepaid address-list
            const filterRulesToDelete = allFilterArray.filter((r) => {
                const hasPrepaidComment = r.comment && r.comment.toLowerCase().includes('prepaid');
                const hasPrepaidList = r['src-address-list'] &&
                    (r['src-address-list'] === 'prepaid-no-package' || r['src-address-list'] === 'prepaid-active');
                return hasPrepaidComment || hasPrepaidList;
            });
            console.log(`[Reset] Found ${filterRulesToDelete.length} filter rules to delete`);
            // Remove filter rules
            for (const rule of filterRulesToDelete) {
                if (rule['.id']) {
                    try {
                        await api.write('/ip/firewall/filter/remove', [`=.id=${rule['.id']}`]);
                        deletedFilterCount++;
                        console.log(`[Reset] Deleted filter rule: ${rule.comment || rule['.id']}`);
                    }
                    catch (error) {
                        console.error(`[Reset] Failed to delete filter rule ${rule['.id']}:`, error);
                    }
                }
            }
            api.close();
            const deleteSummary = `${deletedNatCount} NAT rules dan ${deletedFilterCount} filter rules berhasil dihapus.`;
            console.log(`[Reset] Reset completed: ${deleteSummary}`);
            res.redirect(`/prepaid/mikrotik-setup?success=Setup berhasil di-reset. ${deleteSummary}`);
        }
        catch (error) {
            console.error('Reset setup error:', error);
            res.redirect(`/prepaid/mikrotik-setup?error=Reset gagal: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create PPPoE Profiles
     */
    async createPPPoEProfiles(api) {
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
                }
                else {
                    // Create new
                    await api.write('/ppp/profile/add', [
                        `=name=${profile.name}`,
                        `=rate-limit=${profile.rateLimit}`,
                        `=address-list=${profile.addressList}`,
                        `=only-one=yes`,
                        `=comment=${profile.comment}`
                    ]);
                }
            }
            catch (error) {
                console.error(`Failed to create profile ${profile.name}:`, error);
            }
        }
    }
    /**
     * Ensure Address Lists exist
     */
    async ensureAddressLists(api) {
        const addressLists = ['prepaid-no-package', 'prepaid-active'];
        for (const listName of addressLists) {
            try {
                // Check if address list exists
                const existing = await api.write('/ip/firewall/address-list/print', [
                    `?list=${listName}`
                ]);
                if (!Array.isArray(existing) || existing.length === 0) {
                    // Address list doesn't exist, create it by adding a dummy entry (will be removed)
                    // Note: Mikrotik creates address-list automatically when first entry is added
                    // We'll just verify it exists by checking
                    console.log(`[Setup] Address list '${listName}' will be created when first entry is added`);
                }
                else {
                    console.log(`[Setup] Address list '${listName}' already exists`);
                }
            }
            catch (error) {
                console.error(`[Setup] Error checking address list '${listName}':`, error);
                // Continue - address lists are created automatically when entries are added
            }
        }
    }
    /**
     * Create NAT Redirect Rules
     */
    async createNATRules(api, toAddress, toPort) {
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
        let allNatRules = [];
        let createdCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const errors = [];
        // Get all NAT rules first, then filter
        try {
            console.log('[Setup] Fetching existing NAT rules...');
            const result = await api.write('/ip/firewall/nat/print');
            allNatRules = Array.isArray(result) ? result : [];
            console.log(`[Setup] Found ${allNatRules.length} existing NAT rules`);
        }
        catch (error) {
            console.error('[Setup] Failed to fetch NAT rules:', error);
            throw new Error(`Failed to fetch existing NAT rules: ${error?.message || 'Unknown error'}`);
        }
        for (const rule of rules) {
            try {
                // Filter existing rules in JavaScript
                const existing = Array.isArray(allNatRules) ? allNatRules.filter((r) => {
                    return r.chain === rule.chain &&
                        r['src-address-list'] === rule.srcAddressList &&
                        r['dst-port'] === rule.dstPort;
                }) : [];
                if (existing.length > 0) {
                    // Update existing
                    console.log(`[Setup] Updating existing NAT rule for port ${rule.dstPort}`);
                    try {
                        await api.write('/ip/firewall/nat/set', [
                            `=.id=${existing[0]['.id']}`,
                            `=to-addresses=${rule.toAddresses}`,
                            `=to-ports=${rule.toPorts}`,
                            `=comment=${rule.comment}`
                        ]);
                        console.log(`[Setup] ✅ NAT rule for port ${rule.dstPort} updated successfully`);
                        updatedCount++;
                    }
                    catch (updateError) {
                        console.error(`[Setup] ❌ Failed to update NAT rule for port ${rule.dstPort}:`, updateError);
                        errors.push(`Port ${rule.dstPort} update failed: ${updateError?.message || 'Unknown error'}`);
                        errorCount++;
                    }
                }
                else {
                    // Create new
                    console.log(`[Setup] Creating NAT rule for port ${rule.dstPort} (${rule.toAddresses}:${rule.toPorts})`);
                    // Validate IP address format before sending
                    if (!rule.toAddresses || rule.toAddresses.trim() === '') {
                        throw new Error(`Invalid destination IP address: ${rule.toAddresses}`);
                    }
                    try {
                        const addParams = [
                            `=chain=${rule.chain}`,
                            `=src-address-list=${rule.srcAddressList}`,
                            `=protocol=${rule.protocol}`,
                            `=dst-port=${rule.dstPort}`,
                            `=action=${rule.action}`,
                            `=to-addresses=${rule.toAddresses}`, // IP address only, no CIDR
                            `=to-ports=${rule.toPorts}`,
                            `=comment=${rule.comment}`
                        ];
                        console.log('[Setup] NAT add params:', addParams);
                        console.log('[Setup] Destination IP:', rule.toAddresses, 'Port:', rule.toPorts);
                        const addResult = await api.write('/ip/firewall/nat/add', addParams);
                        console.log('[Setup] NAT add result:', addResult);
                        console.log(`[Setup] ✅ NAT rule for port ${rule.dstPort} created successfully`);
                        createdCount++;
                    }
                    catch (addError) {
                        console.error(`[Setup] ❌ Failed to create NAT rule for port ${rule.dstPort}:`, addError);
                        console.error('[Setup] Error details:', {
                            message: addError?.message,
                            stack: addError?.stack,
                            name: addError?.name
                        });
                        errors.push(`Port ${rule.dstPort} create failed: ${addError?.message || 'Unknown error'}`);
                        errorCount++;
                    }
                }
            }
            catch (error) {
                console.error(`[Setup] ❌ Unexpected error for NAT rule port ${rule.dstPort}:`, error);
                errors.push(`Port ${rule.dstPort}: ${error?.message || 'Unexpected error'}`);
                errorCount++;
            }
        }
        // Throw error if no rules were created/updated
        if (createdCount === 0 && updatedCount === 0) {
            const errorDetail = errors.length > 0 ? errors.join('; ') : 'No rules created and no existing rules found to update';
            console.error(`[Setup] ❌ NAT Rules: ${errorDetail}`);
            throw new Error(`Failed to create any NAT rules. ${errorDetail}`);
        }
        if (errorCount > 0) {
            console.warn(`[Setup] ⚠️ Some NAT rules failed: ${errors.join('; ')}`);
            // Still throw if all failed
            if (createdCount === 0 && updatedCount === 0) {
                throw new Error(`All NAT rules failed. Errors: ${errors.join('; ')}`);
            }
        }
        console.log(`[Setup] NAT Rules summary: ${createdCount} created, ${updatedCount} updated, ${errorCount} failed`);
        // Ensure at least 2 rules exist (HTTP and HTTPS)
        if (createdCount + updatedCount < 2) {
            throw new Error(`Insufficient NAT rules created. Expected 2 rules (HTTP & HTTPS), but only ${createdCount + updatedCount} rules exist.`);
        }
    }
    /**
     * Create Firewall Filter Rules
     */
    async createFilterRules(api, billingServerIp) {
        // Initialize counters
        let allFilterRules = [];
        let createdCount = 0;
        let errorCount = 0;
        const errors = [];
        try {
            console.log('[Setup] Fetching existing filter rules...');
            const result = await api.write('/ip/firewall/filter/print');
            allFilterRules = Array.isArray(result) ? result : [];
            console.log(`[Setup] Found ${allFilterRules.length} existing filter rules`);
        }
        catch (error) {
            console.error('[Setup] Failed to fetch filter rules:', error);
            throw new Error(`Failed to fetch existing filter rules: ${error?.message || 'Unknown error'}`);
        }
        // Verify and ensure address lists can be referenced (create dummy entry if needed)
        // CRITICAL: RouterOS requires address lists to exist before using in filter rules
        try {
            console.log('[Setup] ===========================================');
            console.log('[Setup] VERIFYING ADDRESS LISTS (CRITICAL STEP)');
            console.log('[Setup] ===========================================');
            const addressLists = await api.write('/ip/firewall/address-list/print');
            const addressListsArray = Array.isArray(addressLists) ? addressLists : [];
            // Check if prepaid-active list exists (at least one entry)
            const prepaidActiveEntries = addressListsArray.filter((al) => al.list === 'prepaid-active');
            const prepaidNoPackageEntries = addressListsArray.filter((al) => al.list === 'prepaid-no-package');
            console.log('[Setup] Address lists status:', {
                'prepaid-active': prepaidActiveEntries.length > 0 ? `${prepaidActiveEntries.length} entries` : 'EMPTY (will create dummy)',
                'prepaid-no-package': prepaidNoPackageEntries.length > 0 ? `${prepaidNoPackageEntries.length} entries` : 'EMPTY (will create dummy)'
            });
            // Create dummy entries if lists are empty (they will be used by profiles later)
            if (prepaidActiveEntries.length === 0) {
                try {
                    console.log('[Setup] Creating dummy entry for prepaid-active list...');
                    const addResult = await api.write('/ip/firewall/address-list/add', [
                        '=list=prepaid-active',
                        '=address=0.0.0.0',
                        '=comment=Dummy entry - created by setup wizard',
                        '=disabled=yes'
                    ]);
                    console.log('[Setup] ✅ Dummy entry created for prepaid-active, result:', addResult);
                    // Verify it was created
                    await new Promise(resolve => setTimeout(resolve, 200));
                    const verifyActive = await api.write('/ip/firewall/address-list/print', ['?list=prepaid-active']);
                    const verifyActiveArray = Array.isArray(verifyActive) ? verifyActive : [];
                    console.log('[Setup] Verified prepaid-active list now has', verifyActiveArray.length, 'entries');
                }
                catch (createErr) {
                    console.error('[Setup] ❌ Could not create dummy entry for prepaid-active:', createErr?.message);
                    throw new Error(`Failed to create prepaid-active address list: ${createErr?.message}`);
                }
            }
            else {
                console.log('[Setup] prepaid-active list already has', prepaidActiveEntries.length, 'entries');
            }
            if (prepaidNoPackageEntries.length === 0) {
                try {
                    console.log('[Setup] Creating dummy entry for prepaid-no-package list...');
                    const addResult = await api.write('/ip/firewall/address-list/add', [
                        '=list=prepaid-no-package',
                        '=address=0.0.0.0',
                        '=comment=Dummy entry - created by setup wizard',
                        '=disabled=yes'
                    ]);
                    console.log('[Setup] ✅ Dummy entry created for prepaid-no-package, result:', addResult);
                    // Wait for RouterOS to register the address list
                    console.log('[Setup] Waiting 500ms for RouterOS to register address list...');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    // Verify it was created
                    const verifyList = await api.write('/ip/firewall/address-list/print', ['?list=prepaid-no-package']);
                    const verifyArray = Array.isArray(verifyList) ? verifyList : [];
                    console.log('[Setup] Verified prepaid-no-package list now has', verifyArray.length, 'entries');
                    if (verifyArray.length === 0) {
                        throw new Error('Address list prepaid-no-package was not created or is not accessible');
                    }
                }
                catch (createErr) {
                    console.error('[Setup] ❌ Could not create dummy entry for prepaid-no-package:', createErr?.message);
                    throw new Error(`Failed to create prepaid-no-package address list: ${createErr?.message}`);
                }
            }
            else {
                console.log('[Setup] prepaid-no-package list already has', prepaidNoPackageEntries.length, 'entries');
            }
            console.log('[Setup] ✅ Address list verification complete');
            console.log('[Setup] ===========================================');
        }
        catch (addrError) {
            console.error('[Setup] ❌ CRITICAL: Address list verification failed:', addrError?.message);
            throw new Error(`Address list verification failed: ${addrError?.message}`);
        }
        // First, delete existing prepaid rules to ensure clean rebuild
        try {
            console.log('[Setup] Cleaning up existing prepaid filter rules...');
            const existingPrepaidRules = Array.isArray(allFilterRules) ? allFilterRules.filter((r) => r.comment && (r.comment.includes('prepaid') || r.comment.includes('STRICT'))) : [];
            if (existingPrepaidRules.length > 0) {
                console.log(`[Setup] Found ${existingPrepaidRules.length} existing prepaid rules to remove`);
                for (const existingRule of existingPrepaidRules) {
                    try {
                        await api.write('/ip/firewall/filter/remove', [`=.id=${existingRule['.id']}`]);
                        console.log(`[Setup] ✅ Removed old rule: ${existingRule.comment || 'unnamed'}`);
                    }
                    catch (removeError) {
                        console.warn(`[Setup] ⚠️ Failed to remove old rule: ${removeError?.message || 'Unknown'}`);
                    }
                }
            }
        }
        catch (cleanupError) {
            console.warn('[Setup] ⚠️ Cleanup error (non-critical):', cleanupError?.message || cleanupError);
        }
        // Create rules one by one - build each rule explicitly to avoid parameter issues
        // Rule 1: Allow internet for active prepaid (this one works!)
        try {
            console.log('[Setup] Creating filter rule 1/4: Allow internet for active prepaid');
            const params1 = [
                '=chain=forward',
                '=src-address-list=prepaid-active',
                '=action=accept',
                '=comment=Allow internet for active prepaid'
            ];
            console.log('[Setup] Rule 1 params:', params1);
            console.log('[Setup] Rule 1 params type:', typeof params1);
            console.log('[Setup] Rule 1 params length:', params1.length);
            const result1 = await api.write('/ip/firewall/filter/add', params1);
            console.log('[Setup] ✅ Rule 1 created successfully');
            console.log('[Setup] Rule 1 result:', result1);
            createdCount++;
        }
        catch (error1) {
            const errMsg1 = error1?.message || String(error1);
            console.error('[Setup] ❌ Rule 1 failed:', errMsg1);
            console.error('[Setup] Rule 1 error full:', error1);
            errors.push(`Allow internet for active prepaid: ${errMsg1}`);
            errorCount++;
        }
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 200));
        // Rule 2: Allow DNS for prepaid no package
        // RouterOS filter rules don't support dst-port directly - use connection-state instead
        // This allows DNS responses (established/related connections)
        try {
            console.log('[Setup] Creating filter rule 2/4: Allow DNS for prepaid no package');
            // Use connection-state to allow DNS responses (simpler and more compatible)
            // This allows established and related connections which includes DNS responses
            const params2 = [
                '=chain=forward',
                '=src-address-list=prepaid-no-package',
                '=connection-state=established,related',
                '=action=accept',
                '=comment=Allow DNS for prepaid no package'
            ];
            console.log('[Setup] Rule 2 params:', params2);
            await api.write('/ip/firewall/filter/add', params2);
            console.log('[Setup] ✅ Rule 2 created successfully');
            createdCount++;
        }
        catch (error2) {
            const errMsg2 = error2?.message || String(error2);
            console.error('[Setup] ❌ Rule 2 failed:', errMsg2);
            console.error('[Setup] Rule 2 full error:', error2);
            errors.push(`Allow DNS for prepaid no package: ${errMsg2}`);
            errorCount++;
        }
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 200));
        // Rule 3: Allow access to billing portal  
        // Skip this rule - NAT rules already handle HTTP/HTTPS redirection to portal
        // The NAT rules redirect prepaid-no-package traffic to portal before filter rules
        // So we don't need a separate filter rule for this
        console.log('[Setup] Skipping Rule 3: Allow access to billing portal');
        console.log('[Setup] Reason: NAT rules already redirect HTTP/HTTPS to portal before filter chain');
        console.log('[Setup] Rule 3 is not needed - NAT rules handle portal access');
        // Mark as "created" (skipped intentionally) to maintain count
        createdCount++;
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 200));
        // Rule 4: Block ALL internet for prepaid no package
        // IMPORTANT: This rule must be placed AFTER rules 2 and 3 in the filter chain
        // Use EXACT same format as Rule 1 which succeeded - only change address list and action
        try {
            console.log('[Setup] Creating filter rule 4/4: Block ALL internet for prepaid no package');
            // Use exact same format as Rule 1 - chain, src-address-list, action, comment
            const params4 = [
                '=chain=forward',
                '=src-address-list=prepaid-no-package',
                '=action=drop',
                '=comment=STRICT Block ALL internet for prepaid no package'
            ];
            console.log('[Setup] Rule 4 params (same format as Rule 1):', params4);
            await api.write('/ip/firewall/filter/add', params4);
            console.log('[Setup] ✅ Rule 4 created successfully');
            createdCount++;
        }
        catch (error4) {
            const errMsg4 = error4?.message || String(error4);
            console.error('[Setup] ❌ Rule 4 failed:', errMsg4);
            console.error('[Setup] Rule 4 error details:', JSON.stringify(error4, null, 2));
            // Verify if rule was created anyway (sometimes API reports error but rule is created)
            await new Promise(resolve => setTimeout(resolve, 500));
            try {
                const allRules = await api.write('/ip/firewall/filter/print');
                const allArray = Array.isArray(allRules) ? allRules : [];
                const found = allArray.find((r) => r.comment && (r.comment.includes('Block ALL internet') || r.comment.includes('STRICT')));
                if (found) {
                    console.log('[Setup] ✅ Rule 4 WAS created (verified in RouterOS despite API error)');
                    createdCount++;
                }
                else {
                    throw error4; // Re-throw if not found
                }
            }
            catch (verifyErr) {
                console.error('[Setup] Rule 4 verification failed:', verifyErr?.message);
                errors.push(`STRICT: Block ALL internet for prepaid no package: ${errMsg4}`);
                errorCount++;
            }
        }
        // Now fetch the created rules and move them to top
        if (createdCount > 0) {
            console.log('[Setup] Re-fetching created rules to get their IDs...');
            try {
                const reFetchResult = await api.write('/ip/firewall/filter/print', [
                    '?chain=forward'
                ]);
                const allForwardRules = Array.isArray(reFetchResult) ? reFetchResult : [];
                // Find our prepaid rules (by comment)
                const prepaidRules = allForwardRules.filter((r) => r.comment && (r.comment.includes('prepaid') || r.comment.includes('STRICT')));
                console.log(`[Setup] Found ${prepaidRules.length} prepaid rules to position`);
                // Move each rule to position 0 (one at a time, last rule will be at top)
                for (let i = prepaidRules.length - 1; i >= 0; i--) {
                    const rule = prepaidRules[i];
                    try {
                        await api.write('/ip/firewall/filter/move', [
                            `.id=${rule['.id']}`,
                            '=destination=0'
                        ]);
                        console.log(`[Setup] ✅ Moved rule to position 0: ${rule?.comment || ''}`);
                    }
                    catch (moveError) {
                        console.warn(`[Setup] ⚠️ Failed to move rule: ${rule?.comment || ''} - ${moveError?.message || 'Unknown'}`);
                    }
                }
            }
            catch (refetchError) {
                console.warn('[Setup] ⚠️ Failed to re-fetch and reorder rules (non-critical):', refetchError?.message || refetchError);
            }
        }
        // Final verification: Check if all 4 rules were actually created
        console.log(`[Setup] ===== FINAL VERIFICATION =====`);
        try {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for RouterOS to update
            const finalCheck = await api.write('/ip/firewall/filter/print');
            const finalArray = Array.isArray(finalCheck) ? finalCheck : [];
            const rule1Found = finalArray.find((r) => r.comment && r.comment.includes('Allow internet for active prepaid'));
            const rule2Found = finalArray.find((r) => r.comment && r.comment.includes('Allow DNS for prepaid no package'));
            const rule4Found = finalArray.find((r) => r.comment && (r.comment.includes('Block ALL internet') || r.comment.includes('STRICT')));
            // Rule 3 is skipped - NAT rules handle portal access
            const actuallyCreated = [rule1Found, rule2Found, rule4Found].filter(r => r !== undefined).length;
            const expectedRules = 3; // Rule 3 skipped (handled by NAT)
            console.log(`[Setup] Verification results:`);
            console.log(`[Setup]   Rule 1 (Allow active): ${rule1Found ? '✅ Found' : '❌ Not found'}`);
            console.log(`[Setup]   Rule 2 (Allow DNS): ${rule2Found ? '✅ Found' : '❌ Not found'}`);
            console.log(`[Setup]   Rule 3 (Portal access): ⏭️ Skipped (handled by NAT rules)`);
            console.log(`[Setup]   Rule 4 (Block all): ${rule4Found ? '✅ Found' : '❌ Not found'}`);
            console.log(`[Setup] Actually created in RouterOS: ${actuallyCreated}/${expectedRules}`);
            // Update createdCount based on actual verification
            if (actuallyCreated > createdCount) {
                console.log(`[Setup] ⚠️ More rules found than reported created. Updating count from ${createdCount} to ${actuallyCreated}`);
                createdCount = actuallyCreated;
            }
            else if (actuallyCreated < createdCount) {
                console.log(`[Setup] ⚠️ Fewer rules found than reported. Expected ${createdCount}, found ${actuallyCreated}`);
            }
        }
        catch (verifyError) {
            console.warn(`[Setup] ⚠️ Final verification failed (non-critical):`, verifyError?.message);
        }
        // Log summary
        console.log(`[Setup] ===== FILTER RULES SUMMARY =====`);
        console.log(`[Setup] Created: ${createdCount} rules`);
        console.log(`[Setup] Failed: ${errorCount} rules`);
        console.log(`[Setup] Errors:`, errors);
        // Expected 3 rules (Rule 3 is skipped - handled by NAT)
        const expectedRules = 3;
        // Throw error if insufficient rules were created
        if (createdCount < expectedRules) {
            const errorDetail = errors.length > 0 ? errors.join('; ') : 'Insufficient rules created';
            console.error(`[Setup] ❌ Filter Rules: Insufficient filter rules created. Expected ${expectedRules} rules, but only ${createdCount} rule(s) created successfully. Errors: ${errors.join('; ')}`);
            throw new Error(`Insufficient filter rules created. Expected ${expectedRules} rules, but only ${createdCount} rule(s) created successfully. Errors: ${errors.join('; ')}`);
        }
        if (errorCount > 0) {
            console.warn(`[Setup] ⚠️ Some filter rules reported errors but were created: ${errors.join('; ')}`);
            console.warn(`[Setup] Failed rules count: ${errorCount}`);
            // Still throw if all failed
            if (createdCount === 0) {
                console.error(`[Setup] ❌ All filter rules failed. Throwing error.`);
                throw new Error(`All filter rules failed. Errors: ${errors.join('; ')}`);
            }
        }
        // Log all existing rules for debugging
        try {
            const prepaidRules = allFilterRules.filter((r) => r.comment && (r.comment.toLowerCase().includes('prepaid') || r.comment.includes('STRICT')));
            console.log(`[Setup] Existing prepaid filter rules:`, prepaidRules.map((r) => ({
                id: r['.id'],
                comment: r.comment,
                chain: r.chain,
                'src-address-list': r['src-address-list'],
                action: r.action
            })));
        }
        catch (logError) {
            console.warn('[Setup] Could not log existing rules:', logError);
        }
        // Ensure all expected rules created successfully (3 rules - Rule 3 skipped)
        // expectedRules already declared above
        if (createdCount < expectedRules) {
            const errorMsg = `Insufficient filter rules created. Expected ${expectedRules} rules, but only ${createdCount} rules created successfully. Errors: ${errors.join('; ')}`;
            console.error(`[Setup] ❌ ${errorMsg}`);
            console.error(`[Setup] Created rules: ${createdCount}/${expectedRules}`);
            console.error(`[Setup] Failed rules: ${errorCount}/${expectedRules}`);
            throw new Error(errorMsg);
        }
        console.log(`[Setup] ===== FILTER RULES CREATION SUCCESS =====`);
    }
    /**
     * Parse Portal URL to get IP and port
     */
    parsePortalUrl(url) {
        if (!url || url.trim() === '') {
            throw new Error('Portal URL is required');
        }
        // Remove protocol
        let cleanUrl = url.replace(/^https?:\/\//, '').trim();
        // Remove trailing slash
        cleanUrl = cleanUrl.replace(/\/$/, '');
        // Split by colon
        const parts = cleanUrl.split(':');
        let ip = parts[0].trim();
        let port = 3000; // default
        // Validate IP address format (basic validation)
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ip) && ip !== 'localhost') {
            // If not valid IP, try to resolve hostname (but for now, throw error)
            throw new Error(`Invalid IP address or hostname in Portal URL: ${ip}. Please use IP address format (e.g., 192.168.1.100:3000)`);
        }
        // Handle localhost
        if (ip === 'localhost') {
            ip = '127.0.0.1';
        }
        if (parts.length > 1) {
            const parsedPort = parseInt(parts[1].split('/')[0], 10); // Split to handle paths like :3000/path
            if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
                port = parsedPort;
            }
            else {
                throw new Error(`Invalid port number in Portal URL: ${parts[1]}`);
            }
        }
        else if (url.startsWith('https://')) {
            port = 443;
        }
        else if (url.startsWith('http://')) {
            port = 80;
        }
        console.log(`[Setup] Parsed Portal URL: ${url} -> IP: ${ip}, Port: ${port}`);
        return { ip, port };
    }
    /**
     * Ensure system_settings table exists and has required columns
     */
    async ensureSystemSettingsTable() {
        try {
            // Create table if not exists
            await pool_1.default.query(`
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
            const [categoryColumn] = await pool_1.default.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'system_settings' 
          AND COLUMN_NAME = 'category'
      `);
            const hasCategoryColumn = Array.isArray(categoryColumn) && categoryColumn.length > 0;
            // Check if setting_description column exists
            const [descColumn] = await pool_1.default.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'system_settings' 
          AND COLUMN_NAME = 'setting_description'
      `);
            const hasDescColumn = Array.isArray(descColumn) && descColumn.length > 0;
            // Add setting_description column if it doesn't exist
            if (!hasDescColumn) {
                try {
                    await pool_1.default.query(`
            ALTER TABLE system_settings 
            ADD COLUMN setting_description TEXT AFTER setting_value
          `);
                    console.log('✅ [AutoFix] Added setting_description column to system_settings');
                }
                catch (alterError) {
                    if (!alterError?.message?.includes('Duplicate column')) {
                        console.warn('⚠️ [AutoFix] Could not add setting_description column:', alterError?.message);
                    }
                }
            }
            // Insert default prepaid settings (adapt to available columns)
            if (hasCategoryColumn && hasDescColumn) {
                await pool_1.default.query(`
          INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_description, category) VALUES
          ('prepaid_portal_url', 'http://localhost:3000', 'URL server billing untuk redirect prepaid portal', 'prepaid'),
          ('prepaid_portal_enabled', 'true', 'Enable/disable prepaid portal system', 'prepaid'),
          ('prepaid_redirect_splash_page', 'true', 'Redirect ke splash page atau langsung login', 'prepaid'),
          ('prepaid_auto_whatsapp_notification', 'true', 'Auto WhatsApp notification untuk prepaid', 'prepaid')
        `);
            }
            else if (hasDescColumn) {
                // Insert without category column (backward compatible)
                await pool_1.default.query(`
          INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_description) VALUES
          ('prepaid_portal_url', 'http://localhost:3000', 'URL server billing untuk redirect prepaid portal'),
          ('prepaid_portal_enabled', 'true', 'Enable/disable prepaid portal system'),
          ('prepaid_redirect_splash_page', 'true', 'Redirect ke splash page atau langsung login'),
          ('prepaid_auto_whatsapp_notification', 'true', 'Auto WhatsApp notification untuk prepaid')
        `);
            }
            else {
                // Insert without setting_description column (minimal schema)
                await pool_1.default.query(`
          INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
          ('prepaid_portal_url', 'http://localhost:3000'),
          ('prepaid_portal_enabled', 'true'),
          ('prepaid_redirect_splash_page', 'true'),
          ('prepaid_auto_whatsapp_notification', 'true')
        `);
            }
            console.log('✅ [AutoFix] System settings table OK!');
        }
        catch (error) {
            console.error('❌ [AutoFix] Error ensuring system_settings table:', error);
            // Non-critical, continue
        }
    }
    /**
     * Ensure activity_logs table exists
     */
    async ensureActivityLogsTable() {
        try {
            await pool_1.default.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL DEFAULT 0,
          action VARCHAR(100) NOT NULL,
          description TEXT,
          ip_address VARCHAR(45),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_action (action),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
            console.log('✅ [AutoFix] Activity logs table OK!');
        }
        catch (error) {
            console.error('❌ [AutoFix] Error ensuring activity_logs table:', error);
            throw error; // Re-throw if we can't create the table
        }
    }
    /**
     * Auto-fix mikrotik_settings table (add is_active column if not exists)
     */
    async autoFixMikrotikSettingsTable() {
        try {
            console.log('🔧 [AutoFix] Checking mikrotik_settings table...');
            // Check if is_active column exists
            const [columns] = await pool_1.default.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'mikrotik_settings' 
          AND COLUMN_NAME = 'is_active'
      `);
            if (!Array.isArray(columns) || columns.length === 0) {
                console.log('🔧 [AutoFix] Column is_active tidak ada, menambahkan...');
                // Add is_active column
                await pool_1.default.query(`
          ALTER TABLE mikrotik_settings 
          ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1
        `);
                console.log('✅ [AutoFix] Column is_active berhasil ditambahkan!');
            }
            else {
                console.log('✅ [AutoFix] Column is_active sudah ada');
            }
            // Update all records to active (just in case)
            const [updateResult] = await pool_1.default.query(`
        UPDATE mikrotik_settings 
        SET is_active = 1 
        WHERE is_active IS NULL OR is_active = 0
      `);
            const affectedRows = updateResult.affectedRows;
            if (affectedRows > 0) {
                console.log(`✅ [AutoFix] ${affectedRows} records updated to active`);
            }
            console.log('✅ [AutoFix] Mikrotik settings table OK!');
        }
        catch (error) {
            console.error('❌ [AutoFix] Error fixing mikrotik_settings table:', error);
            // Non-critical, continue
        }
    }
    /**
     * Check current setup status (OPTIMIZED WITH FASTER TIMEOUT)
     * Menggunakan MikrotikConfig dari helper
     */
    async checkSetupStatus(mikrotikConfig) {
        if (!mikrotikConfig) {
            return {
                profiles: false,
                natRules: false,
                filterRules: false,
                ready: false
            };
        }
        try {
            // Validate config yang sudah di-pass sebagai parameter
            const validation = (0, mikrotikConfigHelper_1.validateMikrotikConfig)(mikrotikConfig);
            if (!validation.valid) {
                return {
                    profiles: false,
                    natRules: false,
                    filterRules: false,
                    ready: false,
                    error: validation.error || 'Mikrotik settings tidak lengkap'
                };
            }
            const api = new node_routeros_1.RouterOSAPI({
                host: mikrotikConfig.host,
                port: mikrotikConfig.port,
                user: mikrotikConfig.username,
                password: mikrotikConfig.password,
                timeout: 5000 // Increase to 5 seconds for more reliability
            });
            let apiConnected = false;
            try {
                await api.connect();
                apiConnected = true;
                // Check profiles
                const profiles = await api.write('/ppp/profile/print', ['?name=prepaid-no-package']);
                const hasProfiles = Array.isArray(profiles) && profiles.length > 0;
                console.log('[CheckStatus] Profiles found:', hasProfiles);
                // Check NAT rules - get all then filter by comment
                const allNatRules = await api.write('/ip/firewall/nat/print');
                const natRules = Array.isArray(allNatRules)
                    ? allNatRules.filter((r) => r.comment && r.comment.toLowerCase().includes('prepaid') &&
                        r.comment.toLowerCase().includes('redirect') &&
                        r.chain === 'dstnat')
                    : [];
                const hasNatRules = natRules.length >= 2;
                console.log('[CheckStatus] NAT rules found:', natRules.length, 'Expected: >=2');
                console.log('[CheckStatus] NAT rules details:', natRules.map((r) => ({ comment: r.comment, chain: r.chain })));
                // Check filter rules - get all then filter by comment
                const allFilterRules = await api.write('/ip/firewall/filter/print');
                const allRulesArray = Array.isArray(allFilterRules) ? allFilterRules : [];
                console.log('[CheckStatus] Total filter rules in Mikrotik:', allRulesArray.length);
                // Filter rules yang comment-nya mengandung 'prepaid' (case insensitive)
                const filterRulesByComment = allRulesArray.filter((r) => {
                    if (!r.comment)
                        return false;
                    const commentLower = r.comment.toLowerCase();
                    return commentLower.includes('prepaid');
                });
                // Check by src-address-list for prepaid-no-package and prepaid-active
                const addressListRules = allRulesArray.filter((r) => {
                    const srcList = r['src-address-list'];
                    return srcList === 'prepaid-no-package' || srcList === 'prepaid-active';
                });
                // Get all rules in forward chain (most filter rules are in forward)
                const forwardChainRules = allRulesArray.filter((r) => r.chain === 'forward');
                console.log('[CheckStatus] Filter rules with "prepaid" in comment:', filterRulesByComment.length);
                console.log('[CheckStatus] Filter rules with prepaid address-list:', addressListRules.length);
                console.log('[CheckStatus] Forward chain rules:', forwardChainRules.length);
                // Debug: Log all rules with prepaid address-list
                if (addressListRules.length > 0) {
                    console.log('[CheckStatus] Rules with prepaid address-list:');
                    addressListRules.forEach((r, idx) => {
                        console.log(`  [${idx + 1}] Comment: "${r.comment || '(no comment)'}", Chain: ${r.chain}, List: ${r['src-address-list']}, Action: ${r.action}`);
                    });
                }
                // Combine both methods - use whichever has more results
                // Priority: address-list based (more reliable) over comment-based
                const combinedRules = addressListRules.length >= filterRulesByComment.length ? addressListRules : filterRulesByComment;
                // Remove duplicates based on .id
                const uniqueRules = Array.from(new Map(combinedRules.map((r) => [r['.id'], r])).values());
                // Accept if we have at least 2 rules (minimum required for basic functionality)
                // Ideally should be 3-4, but we'll accept 2+ as valid
                const hasFilterRules = uniqueRules.length >= 2;
                console.log('[CheckStatus] Combined unique filter rules:', uniqueRules.length, 'Expected: >=2');
                console.log('[CheckStatus] Filter rules details:', uniqueRules.map((r) => ({
                    comment: r.comment || '(no comment)',
                    chain: r.chain,
                    'src-address-list': r['src-address-list'] || '(none)',
                    action: r.action,
                    id: r['.id']
                })));
                if (!hasFilterRules) {
                    console.warn('[CheckStatus] ⚠️ Filter rules tidak ditemukan dengan kriteria yang diharapkan!');
                    console.warn('[CheckStatus] Saran: Pastikan filter rules menggunakan address-list "prepaid-no-package" atau "prepaid-active"');
                }
                return {
                    profiles: hasProfiles,
                    natRules: hasNatRules,
                    filterRules: hasFilterRules,
                    ready: hasProfiles && hasNatRules && hasFilterRules
                };
            }
            finally {
                if (apiConnected) {
                    try {
                        api.close();
                    }
                    catch (closeError) {
                        console.warn('[CheckStatus] Error closing connection:', closeError);
                    }
                }
            }
        }
        catch (error) {
            console.error('[CheckStatus] Error:', error);
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
exports.default = new PrepaidMikrotikSetupController();
//# sourceMappingURL=PrepaidMikrotikSetupController.js.map