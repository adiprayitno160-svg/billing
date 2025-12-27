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
                    model VARCHAR(100) DEFAULT 'gemini-1.5-pro',
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
                    'gemini-1.5-pro',
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
            return {
                api_key: settings.api_key || '',
                model: settings.model || 'gemini-1.5-pro',
                enabled: settings.enabled === 1,
                auto_approve_enabled: settings.auto_approve_enabled === 1,
                min_confidence: settings.min_confidence || 70,
                risk_threshold: (settings.risk_threshold || 'medium'),
                max_age_days: settings.max_age_days || 7
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
                    settings.model || 'gemini-1.5-pro',
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
            return false;
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
            return settings.enabled && (settings.api_key?.trim() !== '');
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Test API key
     */
    static async testAPIKey(apiKey) {
        try {
            const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
            // Simple test call
            const result = await model.generateContent('Test');
            await result.response;
            return {
                success: true,
                message: 'API key valid dan berhasil terhubung ke Gemini'
            };
        }
        catch (error) {
            return {
                success: false,
                message: error.message || 'Gagal menguji API key'
            };
        }
    }
}
exports.AISettingsService = AISettingsService;
//# sourceMappingURL=AISettingsService.js.map