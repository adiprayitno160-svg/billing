"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMikrotikSettingsForm = getMikrotikSettingsForm;
exports.postMikrotikSettings = postMikrotikSettings;
exports.getMikrotikInfoApi = getMikrotikInfoApi;
exports.postMikrotikTest = postMikrotikTest;
exports.getSSHOLTSettingsForm = getSSHOLTSettingsForm;
exports.postSSHOLTSettings = postSSHOLTSettings;
exports.testSSHOLTConnection = testSSHOLTConnection;
exports.getSSHOLTStatus = getSSHOLTStatus;
exports.getSSHOLTStatistics = getSSHOLTStatistics;
exports.getCustomerTierManagement = getCustomerTierManagement;
exports.getSLAContractManagement = getSLAContractManagement;
exports.getPaymentReminderManagement = getPaymentReminderManagement;
exports.getTaxCalculationManagement = getTaxCalculationManagement;
exports.getCreditScoreManagement = getCreditScoreManagement;
exports.getIntegrationSettings = getIntegrationSettings;
exports.printSLAContract = printSLAContract;
const pool_1 = require("../db/pool");
const mikrotikService_1 = require("../services/mikrotikService");
async function getMikrotikSettingsForm(req, res) {
    const [rows] = await pool_1.databasePool.query('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
    const settings = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    // Don't auto-test connection on page load to prevent timeout and socket exhaustion
    // User can manually test using the "Test Connection" button
    const status = undefined;
    res.render('settings/mikrotik', { title: 'Pengaturan MikroTik', settings, status });
}
async function postMikrotikSettings(req, res) {
    const payload = {
        host: String(req.body.host ?? ''),
        port: Number(req.body.port ?? 8728),
        username: String(req.body.username ?? ''),
        password: String(req.body.password ?? ''),
        use_tls: Boolean(req.body.use_tls)
    };
    // Check if is_active column exists
    const [columnCheck] = await pool_1.databasePool.query(`SELECT COLUMN_NAME 
		 FROM INFORMATION_SCHEMA.COLUMNS 
		 WHERE TABLE_SCHEMA = DATABASE() 
		   AND TABLE_NAME = 'mikrotik_settings' 
		   AND COLUMN_NAME = 'is_active'`);
    const hasIsActiveColumn = Array.isArray(columnCheck) && columnCheck.length > 0;
    const [rows] = await pool_1.databasePool.query('SELECT id FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
    const exists = Array.isArray(rows) && rows.length > 0 ? rows[0].id : null;
    if (exists) {
        // Set all to inactive first (if column exists), then set current to active
        if (hasIsActiveColumn) {
            await pool_1.databasePool.query('UPDATE mikrotik_settings SET is_active = 0 WHERE is_active = 1');
            await pool_1.databasePool.query('UPDATE mikrotik_settings SET host=?, port=?, username=?, password=?, use_tls=?, is_active=1 WHERE id=?', [payload.host, payload.port, payload.username, payload.password, payload.use_tls ? 1 : 0, exists]);
        }
        else {
            await pool_1.databasePool.query('UPDATE mikrotik_settings SET host=?, port=?, username=?, password=?, use_tls=? WHERE id=?', [payload.host, payload.port, payload.username, payload.password, payload.use_tls ? 1 : 0, exists]);
        }
    }
    else {
        // Insert new with is_active=1 if column exists
        if (hasIsActiveColumn) {
            await pool_1.databasePool.query('INSERT INTO mikrotik_settings (host, port, username, password, use_tls, is_active) VALUES (?, ?, ?, ?, ?, 1)', [payload.host, payload.port, payload.username, payload.password, payload.use_tls ? 1 : 0]);
        }
        else {
            await pool_1.databasePool.query('INSERT INTO mikrotik_settings (host, port, username, password, use_tls) VALUES (?, ?, ?, ?, ?)', [payload.host, payload.port, payload.username, payload.password, payload.use_tls ? 1 : 0]);
        }
    }
    // Setelah simpan, langsung uji koneksi untuk memberi notifikasi terhubung atau tidak
    try {
        const testResult = await (0, mikrotikService_1.testMikrotikConnection)(payload);
        if (testResult.connected) {
            res.redirect('/settings/mikrotik?connected=1');
        }
        else {
            const errMsg = encodeURIComponent(testResult.error || 'Gagal terhubung');
            res.redirect(`/settings/mikrotik?connected=0&error=${errMsg}`);
        }
        return;
    }
    catch (e) {
        const errMsg = encodeURIComponent(e?.message || 'Gagal terhubung');
        res.redirect(`/settings/mikrotik?connected=0&error=${errMsg}`);
        return;
    }
}
// Export this function to be used by the API route
async function getMikrotikInfoApi(req, res) {
    try {
        const [rows] = await pool_1.databasePool.query('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
        const settings = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        if (!settings) {
            res.status(404).json({ ok: false, error: 'Mikrotik settings not found' });
            return;
        }
        const cfg = {
            host: settings.host,
            port: settings.port,
            username: settings.username,
            password: settings.password,
            use_tls: settings.use_tls === 1
        };
        // Add timeout (5 seconds)
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000));
        const infoPromise = (0, mikrotikService_1.getMikrotikInfo)(cfg);
        const info = await Promise.race([infoPromise, timeoutPromise]);
        res.json({ ok: true, info });
    }
    catch (error) {
        console.error('[API] Error fetching Mikrotik info:', error);
        res.status(500).json({ ok: false, error: error.message || 'Failed to fetch Mikrotik info' });
    }
}
async function postMikrotikTest(req, res) {
    const cfg = {
        host: String(req.body.host ?? process.env.MT_HOST ?? '127.0.0.1'),
        port: Number(req.body.port ?? process.env.MT_PORT ?? 8728),
        username: String(req.body.username ?? process.env.MT_USER ?? ''),
        password: String(req.body.password ?? process.env.MT_PASSWORD ?? ''),
        use_tls: Boolean(req.body.use_tls ?? (process.env.MT_TLS === 'true'))
    };
    try {
        const testResult = await (0, mikrotikService_1.testMikrotikConnection)(cfg);
        if (testResult.connected) {
            let info = undefined;
            try {
                info = await (0, mikrotikService_1.getMikrotikInfo)(cfg);
            }
            catch { }
            res.status(200).json({ ok: true, info });
        }
        else {
            res.status(500).json({ ok: false, error: testResult.error || 'Failed to connect' });
        }
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message ?? 'Failed to connect' });
    }
}
// SSH OLT Settings Functions
async function getSSHOLTSettingsForm(req, res) {
    try {
        // Get settings from database or use defaults
        const [rows] = await pool_1.databasePool.query('SELECT * FROM ssh_olt_settings ORDER BY id DESC LIMIT 1');
        let settings = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        // If no settings in database, use environment variables or defaults
        if (!settings) {
            settings = {
                olt_host: process.env.OLT_HOST || '10.11.104.2',
                olt_username: process.env.OLT_USERNAME || 'root',
                olt_password: process.env.OLT_PASSWORD || 'admin',
                olt_ssh_port: parseInt(process.env.OLT_SSH_PORT || '22'),
                connection_timeout: 10000,
                command_timeout: 3000,
                ssh_enabled: process.env.SSH_ENABLED !== 'false'
            };
        }
        res.render('settings/ssh-olt', {
            title: 'Pengaturan SSH OLT',
            settings
        });
    }
    catch (error) {
        console.error('Error getting SSH OLT settings:', error);
        res.render('settings/ssh-olt', {
            title: 'Pengaturan SSH OLT',
            settings: null,
            error: error.message
        });
    }
}
async function postSSHOLTSettings(req, res) {
    try {
        const payload = {
            olt_host: String(req.body.olt_host ?? '10.11.104.2'),
            olt_username: String(req.body.olt_username ?? 'admin'),
            olt_password: String(req.body.olt_password ?? ''),
            olt_ssh_port: Number(req.body.olt_ssh_port ?? 22),
            connection_timeout: Number(req.body.connection_timeout ?? 30000),
            command_timeout: Number(req.body.command_timeout ?? 10000),
            ssh_enabled: Boolean(req.body.ssh_enabled)
        };
        // Check if settings already exist
        const [existingRows] = await pool_1.databasePool.query('SELECT id FROM ssh_olt_settings ORDER BY id DESC LIMIT 1');
        const existingSettings = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
        if (existingSettings) {
            // Update existing settings
            await pool_1.databasePool.execute(`UPDATE ssh_olt_settings SET 
					olt_host = ?, olt_username = ?, olt_password = ?, olt_ssh_port = ?, 
					connection_timeout = ?, command_timeout = ?, ssh_enabled = ?, updated_at = NOW()
				 WHERE id = ?`, [
                payload.olt_host, payload.olt_username, payload.olt_password, payload.olt_ssh_port,
                payload.connection_timeout, payload.command_timeout, payload.ssh_enabled, existingSettings.id
            ]);
        }
        else {
            // Insert new settings
            await pool_1.databasePool.execute(`INSERT INTO ssh_olt_settings (olt_host, olt_username, olt_password, olt_ssh_port, connection_timeout, command_timeout, ssh_enabled, created_at, updated_at) 
				 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`, [
                payload.olt_host, payload.olt_username, payload.olt_password, payload.olt_ssh_port,
                payload.connection_timeout, payload.command_timeout, payload.ssh_enabled
            ]);
        }
        // Update environment variables (optional - for immediate effect)
        process.env.OLT_HOST = payload.olt_host;
        process.env.OLT_USERNAME = payload.olt_username;
        process.env.OLT_PASSWORD = payload.olt_password;
        process.env.OLT_SSH_PORT = payload.olt_ssh_port.toString();
        process.env.SSH_ENABLED = payload.ssh_enabled.toString();
        res.redirect('/settings/ssh-olt?success=1');
    }
    catch (error) {
        console.error('Error saving SSH OLT settings:', error);
        const errMsg = encodeURIComponent(error?.message || 'Gagal menyimpan pengaturan');
        res.redirect(`/settings/ssh-olt?error=${errMsg}`);
    }
}
async function testSSHOLTConnection(req, res) {
    try {
        // SSHService temporarily disabled
        res.status(500).json({
            success: false,
            message: 'SSH Service tidak tersedia'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error?.message || 'Gagal menguji koneksi SSH'
        });
    }
}
async function getSSHOLTStatus(req, res) {
    try {
        // SSHService temporarily disabled
        res.status(200).json({
            success: true,
            data: {
                enabled: false,
                status: 'disabled'
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error?.message || 'Gagal mendapatkan status SSH'
        });
    }
}
async function getSSHOLTStatistics(req, res) {
    try {
        // SSHService temporarily disabled
        res.status(500).json({
            success: false,
            message: 'SSH Service tidak tersedia'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error?.message || 'Gagal mendapatkan statistik OLT'
        });
    }
}
async function getCustomerTierManagement(req, res) {
    try {
        res.render('settings/customer-tier-management', {
            title: 'Customer Tier Management',
            activeTab: 'customer-tiers'
        });
    }
    catch (error) {
        console.error('Error rendering customer tier management:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
}
async function getSLAContractManagement(req, res) {
    try {
        res.render('settings/sla-contract-management', {
            title: 'SLA Contract Management',
            activeTab: 'sla-contracts'
        });
    }
    catch (error) {
        console.error('Error rendering SLA contract management:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
}
async function getPaymentReminderManagement(req, res) {
    try {
        res.render('settings/payment-reminder-management', {
            title: 'Payment Reminder Management',
            activeTab: 'payment-reminders'
        });
    }
    catch (error) {
        console.error('Error rendering payment reminder management:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
}
async function getTaxCalculationManagement(req, res) {
    try {
        res.render('settings/tax-calculation-management', {
            title: 'Tax Calculation Management',
            activeTab: 'tax-calculations'
        });
    }
    catch (error) {
        console.error('Error rendering tax calculation management:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
}
async function getCreditScoreManagement(req, res) {
    try {
        res.render('settings/credit-score-management', {
            title: 'Credit Score Management',
            activeTab: 'credit-score'
        });
    }
    catch (error) {
        console.error('Error rendering credit score management:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
}
async function getIntegrationSettings(req, res) {
    try {
        res.render('settings/integration-settings', {
            title: 'Integration Settings',
            activeTab: 'integrations'
        });
    }
    catch (error) {
        console.error('Error rendering integration settings:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
}
async function printSLAContract(req, res) {
    try {
        const id = parseInt(req.params.id);
        const [rows] = await pool_1.databasePool.query(`SELECT cc.*, c.name as customer_name, c.address as customer_address, 
			        c.phone as customer_phone, c.email as customer_email
			 FROM customer_contracts cc
			 LEFT JOIN customers c ON cc.customer_id = c.id
			 WHERE cc.id = ?`, [id]);
        if (!rows || rows.length === 0) {
            res.status(404).render('error', { title: 'Error', message: 'Contract not found' });
            return;
        }
        res.render('settings/print-sla-contract', {
            title: 'Print SLA Contract',
            contract: rows[0],
            layout: false // Render without sidebar
        });
    }
    catch (error) {
        console.error('Error rendering print SLA contract:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
}
//# sourceMappingURL=settingsController.js.map