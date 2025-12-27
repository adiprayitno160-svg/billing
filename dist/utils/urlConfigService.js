"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UrlConfigService = void 0;
const pool_1 = __importDefault(require("../db/pool"));
/**
 * Service untuk mendapatkan konfigurasi URL berdasarkan mode (domain/local)
 */
class UrlConfigService {
    /**
     * Mendapatkan URL aktif berdasarkan mode yang diaktifkan
     * Prioritas: Domain Mode > Local Mode > Fallback ke localhost
     */
    static async getActiveUrl() {
        try {
            const [rows] = await pool_1.default.query(`SELECT setting_key, setting_value 
         FROM system_settings 
         WHERE setting_key IN ('domain_mode_enabled', 'local_mode_enabled', 'domain_url', 'local_url')`);
            const settings = {};
            rows.forEach((row) => {
                if (row.setting_key && row.setting_value) {
                    settings[row.setting_key] = row.setting_value;
                }
            });
            const domainModeEnabled = settings.domain_mode_enabled === 'true';
            const localModeEnabled = settings.local_mode_enabled === 'true';
            const domainUrl = settings.domain_url || '';
            const localUrl = settings.local_url || 'http://localhost:3000';
            // Prioritas: Domain Mode > Local Mode > Fallback
            if (domainModeEnabled && domainUrl) {
                return domainUrl;
            }
            else if (localModeEnabled && localUrl) {
                return localUrl;
            }
            else {
                // Fallback ke localhost jika tidak ada yang diaktifkan
                return 'http://localhost:3000';
            }
        }
        catch (error) {
            console.error('[UrlConfigService] Error getting active URL:', error);
            // Fallback ke localhost jika ada error
            return 'http://localhost:3000';
        }
    }
    /**
     * Mendapatkan domain URL jika domain mode aktif
     */
    static async getDomainUrl() {
        try {
            const [rows] = await pool_1.default.query(`SELECT setting_value 
         FROM system_settings 
         WHERE setting_key = 'domain_url'`);
            if (Array.isArray(rows) && rows.length > 0 && rows[0]) {
                const firstRow = rows[0];
                return firstRow.setting_value || null;
            }
            return null;
        }
        catch (error) {
            console.error('[UrlConfigService] Error getting domain URL:', error);
            return null;
        }
    }
    /**
     * Mendapatkan local URL jika local mode aktif
     */
    static async getLocalUrl() {
        try {
            const [rows] = await pool_1.default.query(`SELECT setting_value 
         FROM system_settings 
         WHERE setting_key = 'local_url'`);
            if (Array.isArray(rows) && rows.length > 0 && rows[0]) {
                const firstRow = rows[0];
                return firstRow.setting_value || null;
            }
            return null;
        }
        catch (error) {
            console.error('[UrlConfigService] Error getting local URL:', error);
            return null;
        }
    }
    /**
     * Cek apakah domain mode aktif
     */
    static async isDomainModeEnabled() {
        try {
            const [rows] = await pool_1.default.query(`SELECT setting_value 
         FROM system_settings 
         WHERE setting_key = 'domain_mode_enabled'`);
            if (Array.isArray(rows) && rows.length > 0 && rows[0]) {
                const firstRow = rows[0];
                return firstRow.setting_value === 'true';
            }
            return false;
        }
        catch (error) {
            console.error('[UrlConfigService] Error checking domain mode:', error);
            return false;
        }
    }
    /**
     * Cek apakah local mode aktif
     */
    static async isLocalModeEnabled() {
        try {
            const [rows] = await pool_1.default.query(`SELECT setting_value 
         FROM system_settings 
         WHERE setting_key = 'local_mode_enabled'`);
            if (Array.isArray(rows) && rows.length > 0 && rows[0]) {
                const firstRow = rows[0];
                return firstRow.setting_value === 'true';
            }
            return false;
        }
        catch (error) {
            console.error('[UrlConfigService] Error checking local mode:', error);
            return false;
        }
    }
    /**
     * Mendapatkan semua URL yang aktif (domain dan local jika keduanya aktif)
     */
    static async getAllActiveUrls() {
        try {
            const urls = [];
            const domainModeEnabled = await this.isDomainModeEnabled();
            const localModeEnabled = await this.isLocalModeEnabled();
            const domainUrl = await this.getDomainUrl();
            const localUrl = await this.getLocalUrl();
            if (domainModeEnabled && domainUrl) {
                urls.push(domainUrl);
            }
            if (localModeEnabled && localUrl) {
                urls.push(localUrl);
            }
            // Jika tidak ada yang aktif, return fallback
            if (urls.length === 0) {
                urls.push(localUrl || 'http://localhost:3000');
            }
            return urls;
        }
        catch (error) {
            console.error('[UrlConfigService] Error getting all active URLs:', error);
            return ['http://localhost:3000'];
        }
    }
}
exports.UrlConfigService = UrlConfigService;
//# sourceMappingURL=urlConfigService.js.map