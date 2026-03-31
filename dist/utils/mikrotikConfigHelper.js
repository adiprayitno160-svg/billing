"use strict";
/**
 * Helper untuk mengambil konfigurasi MikroTik dari database
 * Digunakan secara konsisten di semua tempat
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMikrotikConfig = getMikrotikConfig;
exports.validateMikrotikConfig = validateMikrotikConfig;
const pool_1 = require("../db/pool");
/**
 * Ensure mikrotik_settings table exists (non-throwing)
 */
async function ensureMikrotikSettingsTable() {
    try {
        await pool_1.databasePool.query(`
      CREATE TABLE IF NOT EXISTS mikrotik_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        host VARCHAR(191) NOT NULL,
        port INT NOT NULL DEFAULT 8728,
        username VARCHAR(191) NOT NULL,
        password VARCHAR(191) NOT NULL,
        use_tls TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    }
    catch (error) {
        // Ignore all errors
    }
}
/**
 * Get MikroTik settings from database
 * NEVER throws error - always returns null if there's any issue
 */
async function getMikrotikConfig() {
    // ABSOLUTE SAFETY: Wrap everything to ensure no rejection
    return Promise.resolve().then(async () => {
        try {
            // Try to ensure table (ignore all errors)
            try {
                await ensureMikrotikSettingsTable();
            }
            catch (e) {
                // Ignore completely
            }
            // Try to query with complete error handling
            let queryResult;
            try {
                queryResult = await pool_1.databasePool.query('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1').catch(() => [[], []]);
            }
            catch (dbError) {
                return null;
            }
            // Safely extract rows
            const [rows] = Array.isArray(queryResult) ? queryResult : [[], []];
            if (Array.isArray(rows) && rows.length > 0) {
                const settings = rows[0];
                // Validate required fields
                if (settings?.host && settings?.username && settings?.password) {
                    const port = Number(settings.api_port || settings.port || 8728) || 8728;
                    return {
                        host: String(settings.host),
                        port: port,
                        api_port: port,
                        username: String(settings.username),
                        password: String(settings.password),
                        use_tls: !!settings.use_tls
                    };
                }
            }
            // No settings found or incomplete
            return null;
        }
        catch (e) {
            // Catch ALL errors
            return null;
        }
    }).catch(() => {
        // Final safety - return null if promise rejected
        return null;
    });
}
/**
 * Validate MikroTik config
 */
function validateMikrotikConfig(config) {
    if (!config) {
        return { valid: false, error: 'Konfigurasi MikroTik tidak ditemukan. Silakan setup di Settings > MikroTik terlebih dahulu.' };
    }
    if (!config.host || config.host.trim() === '') {
        return { valid: false, error: 'Host MikroTik tidak boleh kosong' };
    }
    if (!config.username || config.username.trim() === '') {
        return { valid: false, error: 'Username MikroTik tidak boleh kosong' };
    }
    if (!config.password || config.password.trim() === '') {
        return { valid: false, error: 'Password MikroTik tidak boleh kosong' };
    }
    if (!config.port || config.port < 1 || config.port > 65535) {
        return { valid: false, error: 'Port MikroTik tidak valid (harus antara 1-65535)' };
    }
    return { valid: true };
}
//# sourceMappingURL=mikrotikConfigHelper.js.map