"use strict";
/**
 * AI Settings Service
 * Manages AI (Gemini) configuration from database
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AISettingsService = void 0;
const pool_1 = require("../../db/pool");
class AISettingsService {
    /**
     * Ensure AI settings table exists
     */
    static async ensureAISettingsTable() {
        try {
            await pool_1.databasePool.query(`
                CREATE TABLE IF NOT EXISTS ai_settings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    api_key TEXT,
                    model VARCHAR(100) DEFAULT 'gemini-1.5-flash',
                    enabled TINYINT(1) DEFAULT 1,
                    auto_approve_enabled TINYINT(1) DEFAULT 1,
                    min_confidence INT DEFAULT 70,
                    risk_threshold VARCHAR(20) DEFAULT 'medium',
                    max_age_days INT DEFAULT 7,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_enabled (enabled)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            // Check existing columns
            const [columns] = await pool_1.databasePool.query('SHOW COLUMNS FROM ai_settings');
            const columnNames = columns.map(col => col.Field);
            // Helper to add column if missing
            const ensureColumn = async (colName, colDef, afterCol) => {
                if (!columnNames.includes(colName)) {
                    try {
                        await pool_1.databasePool.query(`ALTER TABLE ai_settings ADD COLUMN ${colName} ${colDef} AFTER ${afterCol}`);
                        console.log(`Column ${colName} added to ai_settings`);
                    }
                    catch (err) {
                        console.error(`Failed to add column ${colName}:`, err);
                    }
                }
            };
            // Ensure columns exist (for migration)
            await ensureColumn('model', 'VARCHAR(100) DEFAULT "gemini-flash-latest"', 'api_key');
            await ensureColumn('enabled', 'TINYINT(1) DEFAULT 1', 'model');
            await ensureColumn('auto_approve_enabled', 'TINYINT(1) DEFAULT 1', 'enabled');
            await ensureColumn('min_confidence', 'INT DEFAULT 70', 'auto_approve_enabled');
            await ensureColumn('risk_threshold', 'VARCHAR(20) DEFAULT "medium"', 'min_confidence');
            await ensureColumn('max_age_days', 'INT DEFAULT 7', 'risk_threshold');
            await ensureColumn('allow_amount_mismatch', 'TINYINT(1) DEFAULT 0', 'max_age_days');
            await ensureColumn('strict_date_check', 'TINYINT(1) DEFAULT 1', 'allow_amount_mismatch');
            // Insert default settings if not exists
            const [existing] = await pool_1.databasePool.query('SELECT id FROM ai_settings LIMIT 1');
            if (existing.length === 0) {
                await pool_1.databasePool.query(`
                    INSERT INTO ai_settings (
                        api_key, model, enabled, auto_approve_enabled,
                        min_confidence, risk_threshold, max_age_days
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    process.env.GEMINI_API_KEY || '',
                    'gemini-flash-latest',
                    0, // Disabled by default until API key is set
                    1,
                    70,
                    'medium',
                    7
                ]);
            }
        }
        catch (error) {
            console.error('Error ensuring AI settings table:', error);
        }
    }
    /**
     * Get AI settings from database
     */
    static async getSettings() {
        try {
            await this.ensureAISettingsTable();
            const [rows] = await pool_1.databasePool.query('SELECT * FROM ai_settings ORDER BY id DESC LIMIT 1');
            if (rows.length === 0) {
                return null;
            }
            const settings = rows[0];
            console.log(`[AISettings] Loaded model: ${settings.model || 'DEFAULT'}`);
            return {
                api_key: settings.api_key || '',
                model: settings.model || 'gemini-flash-latest',
                enabled: settings.enabled === 1,
                auto_approve_enabled: settings.auto_approve_enabled === 1,
                min_confidence: settings.min_confidence || 70,
                risk_threshold: (settings.risk_threshold || 'medium'),
                max_age_days: settings.max_age_days || 7,
                allow_amount_mismatch: settings.allow_amount_mismatch === 1,
                strict_date_check: settings.strict_date_check === 1
            };
        }
        catch (error) {
            console.error('Error getting AI settings:', error);
            return null;
        }
    }
    /**
     * Update AI settings
     */
    static async updateSettings(settings) {
        try {
            await this.ensureAISettingsTable();
            const [existing] = await pool_1.databasePool.query('SELECT id FROM ai_settings ORDER BY id DESC LIMIT 1');
            if (existing.length > 0) {
                // Update existing
                const updateFields = [];
                const updateValues = [];
                if (settings.api_key !== undefined) {
                    updateFields.push('api_key = ?');
                    updateValues.push(settings.api_key);
                }
                if (settings.model !== undefined) {
                    updateFields.push('model = ?');
                    updateValues.push(settings.model);
                }
                if (settings.enabled !== undefined) {
                    updateFields.push('enabled = ?');
                    updateValues.push(settings.enabled ? 1 : 0);
                }
                if (settings.auto_approve_enabled !== undefined) {
                    updateFields.push('auto_approve_enabled = ?');
                    updateValues.push(settings.auto_approve_enabled ? 1 : 0);
                }
                if (settings.min_confidence !== undefined) {
                    updateFields.push('min_confidence = ?');
                    updateValues.push(settings.min_confidence);
                }
                if (settings.risk_threshold !== undefined) {
                    updateFields.push('risk_threshold = ?');
                    updateValues.push(settings.risk_threshold);
                }
                if (settings.max_age_days !== undefined) {
                    updateFields.push('max_age_days = ?');
                    updateValues.push(settings.max_age_days);
                }
                if (settings.allow_amount_mismatch !== undefined) {
                    updateFields.push('allow_amount_mismatch = ?');
                    updateValues.push(settings.allow_amount_mismatch ? 1 : 0);
                }
                if (settings.strict_date_check !== undefined) {
                    updateFields.push('strict_date_check = ?');
                    updateValues.push(settings.strict_date_check ? 1 : 0);
                }
                updateFields.push('updated_at = NOW()');
                updateValues.push(existing[0].id);
                await pool_1.databasePool.query(`UPDATE ai_settings SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
            }
            else {
                // Insert new
                await pool_1.databasePool.query(`
                    INSERT INTO ai_settings (
                        api_key, model, enabled, auto_approve_enabled,
                        min_confidence, risk_threshold, max_age_days
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    settings.api_key || '',
                    settings.model || 'gemini-flash-latest',
                    settings.enabled ? 1 : 0,
                    settings.auto_approve_enabled ? 1 : 0,
                    settings.min_confidence || 70,
                    settings.risk_threshold || 'medium',
                    settings.max_age_days || 7
                ]);
            }
            return true;
        }
        catch (error) {
            console.error('Error updating AI settings:', error);
            throw new Error(error.message || 'Database update failed');
        }
    }
    /**
     * Get API key (from database or env fallback)
     */
    static async getAPIKey() {
        try {
            const settings = await this.getSettings();
            if (settings && settings.api_key && settings.api_key.trim() !== '') {
                return settings.api_key;
            }
            // Fallback to env
            return process.env.GEMINI_API_KEY || null;
        }
        catch (error) {
            console.error('Error getting API key:', error);
            return process.env.GEMINI_API_KEY || null;
        }
    }
    /**
     * Check if AI is enabled
     */
    static async isEnabled() {
        try {
            const settings = await this.getSettings();
            if (!settings) {
                return false;
            }
            // Check if explicitly enabled in DB
            if (!settings.enabled)
                return false;
            // Check if we have a key (from DB or Env)
            const apiKey = await this.getAPIKey();
            return !!(apiKey && apiKey.trim() !== '');
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Test API key
     */
    /**
     * Test API key
     */
    static async testAPIKey(apiKey) {
        try {
            console.log('[AISettingsService] Testing API Key...');
            const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
            // 1. Diagnostics: Check connectivity to google
            try {
                // Use built-in fetch if available, or try a simple lookup
                console.log('[AISettingsService] Checking reachability of generativelanguage.googleapis.com...');
                const testFetch = await fetch('https://generativelanguage.googleapis.com', { method: 'HEAD' }).catch(e => e);
                console.log('[AISettingsService] Reachability check status:', testFetch.status || testFetch);
            }
            catch (netErr) {
                console.warn('[AISettingsService] Reachability warning (ignoring):', netErr.message);
            }
            // 2. Test with Gemini
            const genAI = new GoogleGenerativeAI(apiKey);
            // Use gemini-1.5-flash which is generally available
            const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
            // Simple test call
            console.log('[AISettingsService] Sending test prompt to Gemini...');
            const result = await model.generateContent('Hello');
            const response = await result.response;
            const text = response.text();
            console.log('[AISettingsService] ✅ Gemini Test Success. Response:', text);
            return {
                success: true,
                message: 'API key valid dan berhasil terhubung ke Gemini'
            };
        }
        catch (error) {
            console.error('[AISettingsService] ❌ Test Failed:', error);
            // Detailed error analysis
            let msg = error.message || 'Gagal menguji API key';
            if (msg.includes('fetch failed')) {
                msg += ' (Koneksi jaringan gagal. Cek firewall/DNS)';
            }
            else if (msg.includes('403')) {
                msg += ' (API Key tidak valid atau tidak memiliki izin)';
            }
            else if (msg.includes('404')) {
                msg += ' (Model tidak ditemukan/Validapi key required)';
            }
            else if (msg.includes('400')) {
                msg += ' (Bad Request - Format salah)';
            }
            if (error.cause) {
                msg += ` [Cause: ${error.cause.message || error.cause}]`;
            }
            return {
                success: false,
                message: msg
            };
        }
    }
}
exports.AISettingsService = AISettingsService;
