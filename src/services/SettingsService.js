"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const pool_1 = require("../db/pool");
class SettingsService {
    /**
     * Get setting value by key
     */
    static async get(key, defaultValue = '') {
        try {
            const [rows] = await pool_1.databasePool.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
            return rows.length > 0 ? rows[0].setting_value : defaultValue;
        }
        catch (error) {
            console.warn(`Failed to get setting ${key}, using default:`, error);
            return defaultValue;
        }
    }
    /**
     * Set setting value
     */
    static async set(key, value, description) {
        try {
            if (description) {
                await pool_1.databasePool.query('INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, description = ?', [key, value, description, value, description]);
            }
            else {
                await pool_1.databasePool.query('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
            }
        }
        catch (error) {
            console.error(`Failed to set setting ${key}:`, error);
            throw error;
        }
    }
    /**
     * Get boolean setting
     */
    static async getBoolean(key, defaultValue = false) {
        const val = await this.get(key, defaultValue ? '1' : '0');
        return val === '1' || val === 'true';
    }
    /**
     * Get number setting
     */
    static async getNumber(key, defaultValue = 0) {
        const val = await this.get(key, defaultValue.toString());
        return parseFloat(val);
    }
    /**
     * Get all settings
     */
    static async getAll() {
        try {
            const [rows] = await pool_1.databasePool.query('SELECT * FROM system_settings');
            const settings = {};
            rows.forEach(row => {
                settings[row.setting_key] = row.setting_value;
            });
            return settings;
        }
        catch (error) {
            return {};
        }
    }
}
exports.SettingsService = SettingsService;
