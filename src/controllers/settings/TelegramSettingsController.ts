/**
 * Telegram Settings Controller
 * Handle Telegram Bot configuration
 */

import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';

export class TelegramSettingsController {
    
    /**
     * Show Telegram settings page
     */
    static async showSettings(req: Request, res: Response): Promise<void> {
        try {
            // Get current settings from database
            const [rows] = await pool.query<RowDataPacket[]>(`
                SELECT * FROM telegram_settings 
                ORDER BY id DESC LIMIT 1
            `);
            
            const settings = rows.length > 0 ? rows[0] : {
                bot_token: '',
                auto_start: true
            };
            
            // Get bot info
            const telegramAdminService = await import('../../services/telegram/TelegramAdminService');
            const botInfo = telegramAdminService.default.getBotInfo();
            
            res.render('settings/telegram', {
                title: 'Pengaturan Telegram Bot',
                settings,
                botInfo,
                user: req.session.user
            });
            
        } catch (error) {
            console.error('Error loading telegram settings:', error);
            res.status(500).render('error', {
                error: 'Failed to load Telegram settings',
                user: req.session.user
            });
        }
    }
    
    /**
     * Save Telegram settings
     */
    static async saveSettings(req: Request, res: Response): Promise<void> {
        try {
            const { bot_token, auto_start } = req.body;
            
            if (!bot_token || bot_token.trim() === '') {
                res.json({
                    success: false,
                    message: 'Bot token tidak boleh kosong'
                });
                return;
            }
            
            // Check if settings exist
            const [existing] = await pool.query<RowDataPacket[]>(`
                SELECT id FROM telegram_settings LIMIT 1
            `);
            
            if (existing.length > 0) {
                // Update existing settings
                await pool.query(`
                    UPDATE telegram_settings 
                    SET bot_token = ?, auto_start = ?, updated_at = NOW()
                    WHERE id = ?
                `, [bot_token, auto_start ? 1 : 0, existing[0].id]);
            } else {
                // Insert new settings
                await pool.query(`
                    INSERT INTO telegram_settings (bot_token, auto_start, created_at, updated_at)
                    VALUES (?, ?, NOW(), NOW())
                `, [bot_token, auto_start ? 1 : 0]);
            }
            
            // Update .env file for persistence
            await TelegramSettingsController.updateEnvFile('TELEGRAM_BOT_TOKEN', bot_token);
            
            // Update environment variable
            process.env.TELEGRAM_BOT_TOKEN = bot_token;
            
            res.json({
                success: true,
                message: 'Pengaturan berhasil disimpan. Bot akan aktif setelah restart server.',
                requireRestart: true
            });
            
            // Optional: Restart bot service automatically
            setTimeout(() => {
                TelegramSettingsController.restartBotService();
            }, 1000);
            
        } catch (error) {
            console.error('Error saving telegram settings:', error);
            res.json({
                success: false,
                message: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan'
            });
        }
    }
    
    /**
     * Test bot connection
     */
    static async testConnection(req: Request, res: Response): Promise<void> {
        try {
            const { bot_token } = req.body;
            
            if (!bot_token) {
                res.json({
                    success: false,
                    message: 'Bot token tidak boleh kosong'
                });
                return;
            }
            
            // Try to connect to Telegram
            const bot = new TelegramBot(bot_token, { polling: false });
            const botInfo = await bot.getMe();
            
            // Stop the bot instance
            await bot.close();
            
            res.json({
                success: true,
                message: 'Koneksi berhasil',
                data: {
                    id: botInfo.id,
                    username: botInfo.username,
                    first_name: botInfo.first_name
                }
            });
            
        } catch (error: any) {
            console.error('Error testing bot connection:', error);
            
            let errorMessage = 'Gagal terhubung ke Telegram';
            if (error.message.includes('401')) {
                errorMessage = 'Token tidak valid';
            } else if (error.message.includes('ETELEGRAM')) {
                errorMessage = 'Error dari Telegram API: ' + error.message;
            }
            
            res.json({
                success: false,
                message: errorMessage
            });
        }
    }
    
    /**
     * Restart bot service
     */
    static async restartBot(req: Request, res: Response): Promise<void> {
        try {
            const result = await TelegramSettingsController.restartBotService();
            
            res.json({
                success: result.success,
                message: result.message
            });
            
        } catch (error) {
            console.error('Error restarting bot:', error);
            res.json({
                success: false,
                message: 'Gagal restart bot'
            });
        }
    }
    
    /**
     * Internal: Restart bot service
     */
    private static async restartBotService(): Promise<{ success: boolean; message: string }> {
        try {
            // Get the singleton instance
            const telegramAdminService = (await import('../../services/telegram/TelegramAdminService')).default;
            
            // Get new token from env
            const newToken = process.env.TELEGRAM_BOT_TOKEN || '';
            
            if (!newToken) {
                return {
                    success: false,
                    message: 'Token tidak ditemukan'
                };
            }
            
            // Reinitialize bot dengan token baru
            telegramAdminService.reinitializeBot(newToken);
            
            console.log('[TelegramSettings] Bot service restarted with new token');
            
            return {
                success: true,
                message: 'Bot berhasil direstart'
            };
            
        } catch (error) {
            console.error('[TelegramSettings] Failed to restart bot service:', error);
            return {
                success: false,
                message: 'Gagal restart bot: ' + (error instanceof Error ? error.message : 'Unknown error')
            };
        }
    }
    
    /**
     * Update .env file
     */
    private static async updateEnvFile(key: string, value: string): Promise<void> {
        try {
            const envPath = path.join(process.cwd(), '.env');
            let envContent = '';
            
            // Read existing .env file
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
            }
            
            // Check if key exists
            const keyRegex = new RegExp(`^${key}=.*$`, 'm');
            
            if (keyRegex.test(envContent)) {
                // Update existing key
                envContent = envContent.replace(keyRegex, `${key}=${value}`);
            } else {
                // Add new key
                envContent += `\n${key}=${value}\n`;
            }
            
            // Write back to file
            fs.writeFileSync(envPath, envContent, 'utf8');
            
            console.log(`[TelegramSettings] .env updated: ${key}`);
            
        } catch (error) {
            console.error('[TelegramSettings] Failed to update .env file:', error);
            // Don't throw error, just log it
        }
    }
}

export default TelegramSettingsController;

