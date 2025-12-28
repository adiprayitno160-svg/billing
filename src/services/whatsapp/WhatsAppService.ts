/**
 * Simple WhatsApp Service using whatsapp-web.js
 * Stable and battle-tested library
 */

import * as qrcode from 'qrcode-terminal';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

const { Client, LocalAuth } = require('whatsapp-web.js');

export interface WhatsAppMessageOptions {
    customerId?: number;
    template?: string;
    priority?: 'low' | 'normal' | 'high';
}

export class WhatsAppService {
    private static client: any = null;
    private static isInitialized = false;
    private static isInitializing = false;
    private static isConnected = false;
    private static currentQRCode: string | null = null;
    private static channelColumnExists: boolean | null = null;

    /**
     * Initialize WhatsApp Web client
     */
    static async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.log('✅ WhatsApp service already initialized');
            return;
        }

        if (this.isInitializing) {
            console.log('⏳ WhatsApp service is already initializing');
            return;
        }

        try {
            this.isInitializing = true;
            console.log('📱 Initializing WhatsApp Web service...');

            // Create client with local auth strategy
            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: './whatsapp-session'
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                }
            });

            // QR Code event
            this.client.on('qr', (qr: string) => {
                console.log('📱 QR Code generated');
                qrcode.generate(qr, { small: true });
                this.currentQRCode = qr;
                this.isConnected = false;
            });

            // Ready event
            this.client.on('ready', () => {
                console.log('✅ WhatsApp connection opened successfully!');
                this.isConnected = true;
                this.isInitialized = true;
                this.isInitializing = false;
                this.currentQRCode = null;
            });

            // Authentication event
            this.client.on('authenticated', () => {
                console.log('✅ WhatsApp authenticated');
            });

            // Disconnected event
            this.client.on('disconnected', (reason: string) => {
                console.log('⚠️ WhatsApp disconnected:', reason);
                this.isConnected = false;
                this.isInitialized = false;
                this.initialize();
            });

            // Message event
            this.client.on('message', async (message: any) => {
                try {
                    console.log('📩 New message received');
                    console.log('[WhatsAppService] From:', message.from);
                    console.log('[WhatsAppService] Body:', message.body?.substring(0, 100));

                    // Import bot handler
                    const { WhatsAppBotService } = await import('./WhatsAppBotService');

                    // Create adapter
                    const adapter = {
                        from: message.from,
                        body: message.body || '',
                        hasMedia: message.hasMedia,
                        downloadMedia: async () => {
                            if (!message.hasMedia) {
                                return null;
                            }
                            const media = await message.downloadMedia();
                            return {
                                mimetype: media.mimetype,
                                data: media.data,
                                filename: media.filename || 'file'
                            };
                        }
                    };

                    console.log('[WhatsAppService] Calling WhatsAppBotService.handleMessage()...');
                    await WhatsAppBotService.handleMessage(adapter);
                    console.log('[WhatsAppService] ✅ Message handled successfully');

                } catch (error: any) {
                    console.error('[WhatsAppService] ========== ERROR IN MESSAGE HANDLER ==========');
                    console.error('[WhatsAppService] Error:', error?.message || 'Unknown');
                    console.error('[WhatsAppService] Stack:', error?.stack);
                    console.error('[WhatsAppService] ==========================================');
                }
            });

            // Initialize client
            await this.client.initialize();
            console.log('✅ WhatsApp Web service initialized successfully');

        } catch (error: any) {
            this.isInitializing = false;
            this.isInitialized = false;
            console.error('❌ Failed to initialize WhatsApp service:', error.message || error);
            throw error;
        }
    }

    static isClientReady(): boolean {
        return this.isConnected && this.client !== null;
    }

    static getStatus(): {
        ready: boolean;
        initialized: boolean;
        initializing: boolean;
        authenticated: boolean;
        hasQRCode: boolean
    } {
        return {
            ready: this.isConnected,
            initialized: this.isInitialized,
            initializing: this.isInitializing,
            authenticated: this.isConnected,
            hasQRCode: this.currentQRCode !== null
        };
    }

    static getQRCode(): string | null {
        return this.currentQRCode;
    }

    static async regenerateQRCode(): Promise<void> {
        try {
            console.log('🔄 Regenerating QR code...');

            if (this.client) {
                await this.destroy();
            }

            this.currentQRCode = null;
            this.isConnected = false;
            this.isInitialized = false;

            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.initialize();

        } catch (error) {
            console.error('Failed to regenerate QR code:', error);
            throw error;
        }
    }

    private static formatPhoneNumber(phone: string): string {
        if (!phone || typeof phone !== 'string') {
            throw new Error('Invalid phone number: phone must be a non-empty string');
        }

        let cleaned = phone.replace(/\D/g, '');

        if (!cleaned || cleaned.length < 5) {
            console.warn(`Invalid phone number: "${phone}", cleaned: ${cleaned}`);
            if (!cleaned) return '';
        }

        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }

        if (!cleaned.startsWith('62')) {
            cleaned = '62' + cleaned;
        }

        return cleaned + '@c.us';
    }

    static async sendMessage(
        phone: string,
        message: string,
        options: WhatsAppMessageOptions = {}
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        if (!this.isClientReady()) {
            const error = 'WhatsApp client is not ready. Please scan QR code first.';
            console.error('❌', error);

            await this.logNotification(
                options.customerId,
                phone,
                message,
                'failed',
                error,
                options.template
            );

            return { success: false, error };
        }

        try {
            const formattedPhone = this.formatPhoneNumber(phone);

            if (!formattedPhone) {
                return { success: false, error: 'Invalid phone number format' };
            }

            console.log(`📱 [WhatsApp] Sending message to ${formattedPhone}`);

            const result = await this.client.sendMessage(formattedPhone, message);

            console.log(`✅ WhatsApp message sent to ${phone}`);

            await this.logNotification(
                options.customerId,
                phone,
                message,
                'sent',
                undefined,
                options.template
            );

            return {
                success: true,
                messageId: result?.id?.id || 'unknown'
            };
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';
            console.error(`❌ Failed to send message:`, errorMessage);

            await this.logNotification(
                options.customerId,
                phone,
                message,
                'failed',
                errorMessage,
                options.template
            );

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    private static async logNotification(
        customerId: number | undefined,
        recipient: string,
        message: string,
        status: 'pending' | 'sent' | 'failed',
        errorMessage: string | undefined,
        template: string | undefined
    ): Promise<void> {
        try {
            const [columns] = await databasePool.query('SHOW COLUMNS FROM notification_logs');
            const columnNames = (columns as any[]).map((col: any) => col.Field);

            let query: string;
            let params: any[];

            if (columnNames.includes('channel')) {
                query = `INSERT INTO notification_logs 
                    (customer_id, channel, recipient, template, message, status, error_message, sent_at, created_at)
                    VALUES (?, 'whatsapp', ?, ?, ?, ?, ?, ?, NOW())`;
                params = [
                    customerId || null,
                    recipient,
                    template || null,
                    message,
                    status,
                    errorMessage || null,
                    status === 'sent' ? new Date() : null
                ];
            } else {
                query = `INSERT INTO notification_logs 
                    (customer_id, message, status, sent_at, created_at)
                    VALUES (?, ?, ?, ?, NOW())`;
                params = [
                    customerId || null,
                    message,
                    status,
                    status === 'sent' ? new Date() : null
                ];
            }

            await databasePool.query(query, params);
        } catch (error) {
            console.error('Failed to log notification:', error);
        }
    }

    static async getNotificationHistory(
        limit: number = 50,
        customerId?: number,
        status?: string
    ): Promise<any[]> {
        try {
            let query = `SELECT id, customer_id, channel, recipient, template, message, status, 
                        error_message, sent_at, created_at
                        FROM notification_logs WHERE 1=1`;
            const params: any[] = [];

            if (this.channelColumnExists === null) {
                try {
                    await databasePool.query<RowDataPacket[]>('SELECT channel FROM notification_logs LIMIT 1');
                    this.channelColumnExists = true;
                } catch {
                    this.channelColumnExists = false;
                }
            }

            if (this.channelColumnExists) {
                query += " AND channel = 'whatsapp'";
            }

            if (customerId) {
                query += ' AND customer_id = ?';
                params.push(customerId);
            }

            if (status) {
                query += ' AND status = ?';
                params.push(status);
            }

            query += ' ORDER BY created_at DESC LIMIT ?';
            params.push(limit);

            const [rows] = await databasePool.query<RowDataPacket[]>(query, params);
            return rows;
        } catch (error) {
            console.error('Failed to get notification history:', error);
            return [];
        }
    }

    static async getNotificationStats(): Promise<{
        total: number;
        sent: number;
        failed: number;
        pending: number;
        successRate: number;
    }> {
        try {
            let query = `SELECT COUNT(*) as total,
                        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
                        FROM notification_logs
                        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;

            if (this.channelColumnExists === null) {
                try {
                    await databasePool.query<RowDataPacket[]>('SELECT channel FROM notification_logs LIMIT 1');
                    this.channelColumnExists = true;
                } catch {
                    this.channelColumnExists = false;
                }
            }

            if (this.channelColumnExists) {
                query = query.replace('WHERE created_at', "WHERE channel = 'whatsapp' AND created_at");
            }

            const [rows] = await databasePool.query<RowDataPacket[]>(query);
            const stats = rows[0];

            if (!stats) {
                return { total: 0, sent: 0, failed: 0, pending: 0, successRate: 0 };
            }

            const total = parseInt(stats.total || '0', 10);
            const sent = parseInt(stats.sent || '0', 10);
            const successRate = total > 0 ? (sent / total) * 100 : 0;

            return {
                total,
                sent,
                failed: parseInt(stats.failed || '0', 10),
                pending: parseInt(stats.pending || '0', 10),
                successRate: Math.round(successRate * 100) / 100
            };
        } catch (error) {
            console.error('Failed to get notification stats:', error);
            return { total: 0, sent: 0, failed: 0, pending: 0, successRate: 0 };
        }
    }

    static async sendBulkMessages(
        recipients: Array<{
            phone: string;
            message: string;
            customerId?: number;
            template?: string;
        }>,
        delayMs: number = 2000
    ): Promise<{
        total: number;
        sent: number;
        failed: number;
        results: Array<{
            phone: string;
            success: boolean;
            error?: string;
        }>;
    }> {
        console.log(`📱 [Bulk] Sending ${recipients.length} messages with ${delayMs}ms delay`);

        const results: Array<{ phone: string; success: boolean; error?: string }> = [];
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            const result = await this.sendMessage(recipient.phone, recipient.message, {
                customerId: recipient.customerId,
                template: recipient.template
            });

            if (result.success) {
                sent++;
                results.push({ phone: recipient.phone, success: true });
            } else {
                failed++;
                results.push({
                    phone: recipient.phone,
                    success: false,
                    error: result.error
                });
            }

            if (i < recipients.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        return {
            total: recipients.length,
            sent,
            failed,
            results
        };
    }

    static async destroy(): Promise<void> {
        if (this.client) {
            try {
                await this.client.destroy();
                console.log('✅ WhatsApp client destroyed');
            } catch (error) {
                console.warn('⚠️ Error during cleanup:', error);
            }

            this.client = null;
            this.isInitialized = false;
            this.isConnected = false;
            this.currentQRCode = null;
        }
    }
}
