"use strict";
/**
 * About Service
 * Service untuk mengelola informasi aplikasi, versi, dan fitur
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppVersion = getAppVersion;
exports.getAppFeatures = getAppFeatures;
exports.checkForUpdates = checkForUpdates;
exports.getUpdateSettings = getUpdateSettings;
exports.saveUpdateSettings = saveUpdateSettings;
exports.applyUpdate = applyUpdate;
exports.performFullUpdate = performFullUpdate;
exports.getUpdateHistory = getUpdateHistory;
const pool_1 = __importDefault(require("../db/pool"));
const GitHubService_1 = require("./update/GitHubService");
const UpdateService_1 = require("./update/UpdateService");
/**
 * Get setting from database
 */
async function getSetting(key) {
    try {
        const [rows] = await pool_1.default.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
        return rows.length > 0 ? rows[0].setting_value : null;
    }
    catch (error) {
        console.error(`Error getting setting ${key}:`, error);
        return null;
    }
}
/**
 * Update setting in database
 */
async function updateSetting(key, value) {
    try {
        await pool_1.default.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
    }
    catch (error) {
        console.error(`Error updating setting ${key}:`, error);
    }
}
/**
 * Get application version information
 * ⚠️ HANYA menampilkan MAJOR versions (2.0.8), TIDAK termasuk hotfixes (2.0.8.5)
 */
async function getAppVersion() {
    try {
        // Use MAJOR version only (from VERSION_MAJOR file)
        const currentVersion = GitHubService_1.GitHubService.getMajorVersion();
        // Check for MAJOR updates only (ignores hotfixes)
        const updateCheck = await GitHubService_1.GitHubService.checkForMajorUpdates();
        // Get changelog from latest releases
        const releases = await GitHubService_1.GitHubService.getAllReleases(5);
        const changelog = releases
            .slice(0, 5)
            .map(r => `${r.tag_name}: ${r.body?.split('\n')[0] || 'No description'}`)
            .filter(c => c);
        return {
            current: currentVersion,
            latest: updateCheck.latestVersion,
            releaseDate: updateCheck.publishedAt || new Date().toISOString(),
            changelog: changelog.length > 0 ? changelog : [
                'Sistem Billing Management dengan integrasi MikroTik',
                'WhatsApp Bot untuk notifikasi otomatis',
                'Telegram Bot untuk monitoring dan manajemen',
                'Dashboard monitoring real-time',
                'Payment Gateway Integration',
                'FTTH Management (OLT, ODC, ODP)',
                'SLA Monitoring & Reporting',
                'Backup & Restore System',
                'Multi-user Management',
                'Kasir / POS System'
            ],
            isUpdateAvailable: updateCheck.available
        };
    }
    catch (error) {
        console.error('Error getting app version:', error);
        // Fallback
        return {
            current: '1.0.0',
            latest: '1.0.0',
            releaseDate: new Date().toISOString(),
            changelog: ['Initial version'],
            isUpdateAvailable: false
        };
    }
}
/**
 * Get application features
 */
async function getAppFeatures() {
    const currentVersion = await GitHubService_1.GitHubService.getCurrentVersion();
    return [
        {
            name: 'Billing Management',
            description: 'Manajemen tagihan pelanggan, pembayaran, dan pelaporan keuangan',
            version: currentVersion,
            status: 'active',
            category: 'billing'
        },
        {
            name: 'MikroTik Integration',
            description: 'Integrasi lengkap dengan MikroTik RouterOS untuk manajemen PPPoE dan Static IP',
            version: currentVersion,
            status: 'active',
            category: 'network'
        },
        {
            name: 'FTTH Management',
            description: 'Manajemen infrastruktur fiber optik (OLT, ODC, ODP)',
            version: currentVersion,
            status: 'active',
            category: 'network'
        },
        {
            name: 'Network Monitoring',
            description: 'Monitoring real-time status jaringan dan koneksi pelanggan',
            version: currentVersion,
            status: 'active',
            category: 'monitoring'
        },
        {
            name: 'SLA Monitoring',
            description: 'Monitoring Service Level Agreement dan uptime pelanggan',
            version: currentVersion,
            status: 'active',
            category: 'monitoring'
        },
        {
            name: 'WhatsApp Bot',
            description: 'Bot WhatsApp untuk notifikasi tagihan dan komunikasi pelanggan',
            version: currentVersion,
            status: 'active',
            category: 'system'
        },
        {
            name: 'Telegram Bot',
            description: 'Bot Telegram untuk notifikasi dan manajemen sistem',
            version: currentVersion,
            status: 'active',
            category: 'system'
        },
        {
            name: 'Payment Gateway',
            description: 'Integrasi payment gateway untuk pembayaran online',
            version: currentVersion,
            status: 'active',
            category: 'billing'
        },
        {
            name: 'Kasir/POS System',
            description: 'Sistem kasir untuk pembayaran langsung di lokasi',
            version: currentVersion,
            status: 'active',
            category: 'billing'
        },
        {
            name: 'Backup & Restore',
            description: 'Sistem backup dan restore database otomatis',
            version: currentVersion,
            status: 'active',
            category: 'system'
        },
        {
            name: 'Auto Update System',
            description: 'Sistem update otomatis dari GitHub',
            version: currentVersion,
            status: 'active',
            category: 'system'
        }
    ];
}
/**
 * Check for updates
 * ⚠️ HANYA check MAJOR updates, TIDAK termasuk hotfixes
 */
async function checkForUpdates() {
    try {
        // Check for MAJOR updates only (ignores hotfixes like 2.0.8.1, 2.0.8.2, etc)
        const updateCheck = await GitHubService_1.GitHubService.checkForMajorUpdates();
        if (!updateCheck.available) {
            return {
                available: false,
                version: updateCheck.currentVersion
            };
        }
        // Parse changelog into array
        const changelogLines = updateCheck.changelog
            .split('\n')
            .filter(line => line.trim().length > 0)
            .slice(0, 10); // Max 10 lines
        return {
            available: true,
            version: updateCheck.latestVersion,
            releaseDate: updateCheck.publishedAt,
            changelog: changelogLines
        };
    }
    catch (error) {
        console.error('Error checking for updates:', error);
        return {
            available: false
        };
    }
}
/**
 * Get update settings
 */
async function getUpdateSettings() {
    const autoUpdate = await getSetting('auto_update_enabled');
    const updateChannel = await getSetting('update_channel');
    return {
        autoUpdate: autoUpdate === 'true',
        updateChannel: updateChannel || 'stable'
    };
}
/**
 * Update settings
 */
async function saveUpdateSettings(settings) {
    await updateSetting('auto_update_enabled', settings.autoUpdate.toString());
    await updateSetting('update_channel', settings.updateChannel);
}
/**
 * Apply update
 */
async function applyUpdate(version) {
    return await UpdateService_1.UpdateService.applyUpdate(version);
}
/**
 * Perform full update
 */
async function performFullUpdate(version) {
    return await UpdateService_1.UpdateService.performFullUpdate(version);
}
/**
 * Get update history
 */
async function getUpdateHistory(limit = 10) {
    return await UpdateService_1.UpdateService.getUpdateHistory(limit);
}
//# sourceMappingURL=aboutService.js.map