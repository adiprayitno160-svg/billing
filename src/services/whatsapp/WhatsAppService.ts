import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import * as fs from 'fs';
import * as path from 'path';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export interface WhatsAppMessageOptions {
    customerId?: number;
    template?: string;
    priority?: 'low' | 'normal' | 'high';
}

export class WhatsAppService {
    private static client: Client | null = null;
    private static isInitialized = false;
    private static isInitializing = false;
    private static isReady = false;
    private static reconnectAttempts = 0;
    private static maxReconnectAttempts = 5;
    private static sessionPath = './whatsapp-session';
    private static currentQRCode: string | null = null;
    private static isAuthenticated = false;
    private static channelColumnExists: boolean | null = null;

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
            console.log('📱 Initializing WhatsApp service (whatsapp-web.js)...');

            // Force check puppeteer
            try {
                require('puppeteer');
            } catch (e) {
                console.warn('⚠️ Puppeteer not found, installing...');
                // You might need to handle this manually or ensure it's in package.json
            }

            const absoluteSessionPath = path.join(process.cwd(), 'whatsapp-session');
            console.log(`   Session path: ${absoluteSessionPath}`);

            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: absoluteSessionPath
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

            this.client.on('qr', (qr) => {
                console.log('📱 QR Code received from WhatsApp');
                this.currentQRCode = qr;
                // qrcode.generate(qr, { small: true }); // Optional: terminal QR
            });

            this.client.on('ready', () => {
                console.log('✅ WhatsApp Client is ready!');
                this.isReady = true;
                this.isInitialized = true;
                this.getConnectionState();
            });

            this.client.on('authenticated', () => {
                console.log('✅ WhatsApp Client Authenticated');
                this.isAuthenticated = true;
                this.currentQRCode = null;
            });

            this.client.on('auth_failure', (msg) => {
                console.error('❌ WhatsApp Authentication Failure:', msg);
                this.isAuthenticated = false;
                this.isInitialized = false;
                this.currentQRCode = null;
            });

            this.client.on('disconnected', (reason) => {
                console.log('⚠️ WhatsApp Client Disconnected:', reason);
                this.isReady = false;
                this.isAuthenticated = false;
                this.isInitialized = false;
                this.currentQRCode = null;

                // Auto reconnect logic could go here
                // if (reason !== 'LOGOUT') this.initialize(); 
            });

            this.client.on('message', async (message) => {
                if (message.body === '!ping') {
                    message.reply('pong');
                }
            });

            console.log('🚀 Starting WhatsApp Client...');
            await this.client.initialize();
            this.isInitializing = false;
            console.log('✅ WhatsApp initialization command sent');

        } catch (error: any) {
            this.isInitializing = false;
            this.isInitialized = false;
            console.error('❌ Failed to initialize WhatsApp service:', error);
        }
    }

    private static async getConnectionState() {
        if (!this.client) return;
        try {
            const state = await this.client.getState();
            console.log('📱 Connection State:', state);
        } catch (e) {
            console.error('Error getting state:', e);
        }
    }

    static getStatus(): {
        ready: boolean;
        initialized: boolean;
        initializing: boolean;
        authenticated: boolean;
        hasQRCode: boolean
    } {
        return {
            ready: this.isReady,
            initialized: this.isInitialized,
            initializing: this.isInitializing,
            authenticated: this.isAuthenticated,
            hasQRCode: this.currentQRCode !== null
        };
    }

    static getQRCode(): string | null {
        return this.currentQRCode;
    }

    static isClientReady(): boolean {
        return this.isReady;
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

    static async regenerateQRCode(): Promise<void> {
        try {
            console.log('🔄 Regenerating QR code...');

            if (this.client) {
                console.log('   Destroying existing client...');
                await this.client.destroy();
                this.client = null;
            }

            // Remove session directory
            const sessionPath = path.join(process.cwd(), 'whatsapp-session');
            if (fs.existsSync(sessionPath)) {
                console.log('   Removing session files...');
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }

            this.isInitialized = false;
            this.isReady = false;
            this.isAuthenticated = false;
            this.currentQRCode = null;

            console.log('   Re-initializing...');
            await this.initialize();
            console.log('✅ QR Reset Complete');

        } catch (error) {
            console.error('Failed to regenerate QR code:', error);
            throw error;
        }
    }

    static async destroy(): Promise<void> {
        if (this.client) {
            try {
                await this.client.destroy();
            } catch (error) {
                console.warn('Error destroying client:', error);
            }
            this.client = null;
            this.isInitialized = false;
            this.isReady = false;
            this.isAuthenticated = false;
            this.currentQRCode = null;
        }
    }

    private static formatPhoneNumber(phone: string): string {
        let cleaned = phone.replace(/\D/g, '');
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

        if (!this.client || !this.isReady) {
            const error = 'WhatsApp client not ready';
            console.warn(`⚠️ Failed to send to ${phone}: ${error}`);

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
            const chatId = this.formatPhoneNumber(phone);
            const msg = await this.client.sendMessage(chatId, message);
            console.log(`✅ Message sent to ${phone}`);

            await this.logNotification(
                options.customerId,
                phone,
                message,
                'sent',
                undefined,
                options.template
            );

            return { success: true, messageId: msg.id.id };
        } catch (error: any) {
            console.error(`❌ Error sending message to ${phone}:`, error);

            await this.logNotification(
                options.customerId,
                phone,
                message,
                'failed',
                error.message || 'Unknown error',
                options.template
            );

            return { success: false, error: error.message };
        }
    }

    // Compatible method signature for bulk messages (although simpler implementation)
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
        console.log(`📱 [Bulk] Sending ${recipients.length} messages (one-by-one)`);

        const results = [];
        let sent = 0;
        let failed = 0;

        for (const recipient of recipients) {
            // Add delay
            if (results.length > 0) {
                await new Promise(r => setTimeout(r, delayMs));
            }

            const result = await this.sendMessage(recipient.phone, recipient.message, {
                customerId: recipient.customerId,
                template: recipient.template
            });

            if (result.success) sent++;
            else failed++;

            results.push({
                phone: recipient.phone,
                success: result.success,
                error: result.error
            });
        }

        return { total: recipients.length, sent, failed, results };
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
}
