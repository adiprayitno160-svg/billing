/**
 * AI Settings Service
 * Manages AI (Gemini) configuration from database
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export interface AISettings {
    api_key: string;
    model: string;
    enabled: boolean;
    auto_approve_enabled: boolean;
    min_confidence: number;
    risk_threshold: 'low' | 'medium' | 'high';
    max_age_days: number;
}

export class AISettingsService {
    /**
     * Ensure AI settings table exists
     */
    static async ensureAISettingsTable(): Promise<void> {
        try {
            await databasePool.query(`
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

            // Check existing columns
            const [columns] = await databasePool.query<RowDataPacket[]>('SHOW COLUMNS FROM ai_settings');
            const columnNames = columns.map(col => col.Field);

            // Helper to add column if missing
            const ensureColumn = async (colName: string, colDef: string, afterCol: string) => {
                if (!columnNames.includes(colName)) {
                    try {
                        await databasePool.query(`ALTER TABLE ai_settings ADD COLUMN ${colName} ${colDef} AFTER ${afterCol}`);
                        console.log(`Column ${colName} added to ai_settings`);
                    } catch (err) {
                        console.error(`Failed to add column ${colName}:`, err);
                    }
                }
            };

            await ensureColumn('risk_threshold', 'VARCHAR(20) DEFAULT "medium"', 'min_confidence');
            await ensureColumn('max_age_days', 'INT DEFAULT 7', 'risk_threshold');
            await ensureColumn('model', 'VARCHAR(100) DEFAULT "gemini-1.5-pro"', 'api_key');
            await ensureColumn('auto_approve_enabled', 'TINYINT(1) DEFAULT 1', 'enabled');

            // Insert default settings if not exists
            const [existing] = await databasePool.query<RowDataPacket[]>(
                'SELECT id FROM ai_settings LIMIT 1'
            );

            if (existing.length === 0) {
                await databasePool.query(`
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
        } catch (error) {
            console.error('Error ensuring AI settings table:', error);
        }
    }

    /**
     * Get AI settings from database
     */
    static async getSettings(): Promise<AISettings | null> {
        try {
            await this.ensureAISettingsTable();

            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM ai_settings ORDER BY id DESC LIMIT 1'
            );

            if (rows.length === 0) {
                return null;
            }

            const settings = rows[0] as any;
            return {
                api_key: settings.api_key || '',
                model: settings.model || 'gemini-1.5-pro',
                enabled: settings.enabled === 1,
                auto_approve_enabled: settings.auto_approve_enabled === 1,
                min_confidence: settings.min_confidence || 70,
                risk_threshold: (settings.risk_threshold || 'medium') as 'low' | 'medium' | 'high',
                max_age_days: settings.max_age_days || 7
            };
        } catch (error) {
            console.error('Error getting AI settings:', error);
            return null;
        }
    }

    /**
     * Update AI settings
     */
    static async updateSettings(settings: Partial<AISettings>): Promise<boolean> {
        try {
            await this.ensureAISettingsTable();

            const [existing] = await databasePool.query<RowDataPacket[]>(
                'SELECT id FROM ai_settings ORDER BY id DESC LIMIT 1'
            );

            if (existing.length > 0) {
                // Update existing
                const updateFields: string[] = [];
                const updateValues: any[] = [];

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

                await databasePool.query(
                    `UPDATE ai_settings SET ${updateFields.join(', ')} WHERE id = ?`,
                    updateValues
                );
            } else {
                // Insert new
                await databasePool.query(`
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
        } catch (error: any) {
            console.error('Error updating AI settings:', error);
            throw new Error(error.message || 'Database update failed');
        }
    }

    /**
     * Get API key (from database or env fallback)
     */
    static async getAPIKey(): Promise<string | null> {
        try {
            const settings = await this.getSettings();
            if (settings && settings.api_key && settings.api_key.trim() !== '') {
                return settings.api_key;
            }
            // Fallback to env
            return process.env.GEMINI_API_KEY || null;
        } catch (error) {
            console.error('Error getting API key:', error);
            return process.env.GEMINI_API_KEY || null;
        }
    }

    /**
     * Check if AI is enabled
     */
    static async isEnabled(): Promise<boolean> {
        try {
            const settings = await this.getSettings();
            if (!settings) {
                return false;
            }
            return settings.enabled && (settings.api_key?.trim() !== '');
        } catch (error) {
            return false;
        }
    }

    /**
     * Test API key
     */
    static async testAPIKey(apiKey: string): Promise<{ success: boolean; message: string }> {
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

            // Simple test call
            const result = await model.generateContent('Test');
            await result.response;

            return {
                success: true,
                message: 'API key valid dan berhasil terhubung ke Gemini'
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message || 'Gagal menguji API key'
            };
        }
    }
}











