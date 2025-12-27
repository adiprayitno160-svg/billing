/**
 * Modern WhatsApp Service using Baileys (Multi-Device)
 * Fixed with dynamic import for CommonJS compatibility
 */

import * as qrcode from 'qrcode-terminal';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import * as fs from 'fs';
import * as path from 'path';

export interface WhatsAppMessageOptions {
    customerId?: number;
    template?: string;
    priority?: 'low' | 'normal' | 'high';
}

// Dynamic import wrapper for Baileys
let baileysModule: any = null;

async function loadBaileys() {
    if (!baileysModule) {
        baileysModule = await import('@whiskeysockets/baileys');
    }
    return baileysModule;
}

export class BaileysWhatsAppService {
    private static sock: any = null;
    private static isInitialized = false;
    private static isInitializing = false;
    private static isConnected = false;
    private static currentQRCode: string | null = null;
    private static sessionPath = path.join(process.cwd(), 'baileys-session');
    private static reconnectAttempts = 0;
    private static maxReconnectAttempts = 5;
    private static channelColumnExists: boolean | null = null;

    /**
     * Initialize Baileys WhatsApp client with dynamic import
     */
    static async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.log('✅ Baileys WhatsApp service already initialized');
            return;
        }

        if (this.isInitializing) {
            console.log('⏳ Baileys WhatsApp service is already initializing');
            return;
        }

        try {
            this.isInitializing = true;
            console.log('📱 Initializing Baileys WhatsApp service...');
            console.log(`   Session path: ${this.sessionPath}`);

            // Load Baileys module dynamically
            const baileys = await loadBaileys();
            const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion,
                makeCacheableSignalKeyStore, DisconnectReason, Browsers } = baileys;

            // Create Pino logger dynamically
            const pino = await import('pino');
            const logger = pino.default({
                level: process.env.NODE_ENV === 'production' ? 'silent' : 'error'
            });

            // Create session directory if doesn't exist
            if (!fs.existsSync(this.sessionPath)) {
                fs.mkdirSync(this.sessionPath, { recursive: true });
                console.log('✅ Session directory created');
            }

            // Load auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
            console.log('✅ Auth state loaded');

            // Get latest Baileys version
            const { version, isLatest } = await fetchLatestBaileysVersion();
            console.log(`📱 Using WA v${version.join('.')}, isLatest: ${isLatest}`);

            // Create socket
            this.sock = makeWASocket({
                version,
                logger: logger,
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger)
                },
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                getMessage: async (key: any) => {
                    return { conversation: '' };
                }
            });

            console.log('✅ Baileys socket created');

            // Handle credentials update
            this.sock.ev.on('creds.update', saveCreds);

            // Load Boom for error handling
            const Boom = (await import('@hapi/boom')).Boom;

            // Handle connection updates
            this.sock.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    console.log('📱 QR Code generated');
                    qrcode.generate(qr, { small: true });
                    this.currentQRCode = qr;
                    this.isConnected = false;
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;

                    console.log('⚠️ Connection closed:', lastDisconnect?.error);
                    console.log(`   Should reconnect: ${shouldReconnect}`);

                    this.isConnected = false;
                    this.isInitialized = false;
                    this.isInitializing = false;

                    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`🔄 Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        await this.initialize();
                    } else if (!shouldReconnect) {
                        console.log('🚪 Logged out. Please scan QR code again.');
                        this.currentQRCode = null;
                    } else {
                        console.error('❌ Max reconnection attempts reached');
                    }
                } else if (connection === 'open') {
                    console.log('✅ WhatsApp connection opened successfully!');
                    this.isConnected = true;
                    this.isInitialized = true;
                    this.isInitializing = false;
                    this.currentQRCode = null;
                    this.reconnectAttempts = 0;
                } else if (connection === 'connecting') {
                    console.log('⏳ Connecting to WhatsApp...');
                }
            });

            // Handle incoming messages
            this.sock.ev.on('messages.upsert', async (m: any) => {
                const message = m.messages[0];
                if (!message.key.fromMe && m.type === 'notify') {
                    console.log('📩 New message received');
                    try {
                        const { WhatsAppBotService } = await import('./WhatsAppBotService');
                        // Handle bot messages if needed
                    } catch (error) {
                        console.error('Error handling bot message:', error);
                    }
                }
            });

            this.isInitialized = true;
            this.isInitializing = false;

            console.log('✅ Baileys WhatsApp service initialized successfully');
            console.log('   Waiting for connection or QR code...');

        } catch (error: any) {
            this.isInitializing = false;
            this.isInitialized = false;
            console.error('❌ Failed to initialize Baileys WhatsApp service:');
            console.error('   Error:', error.message || error);
            console.error('   Stack:', error.stack);
            throw error;
        }
    }

    static isClientReady(): boolean {
        return this.isConnected && this.sock !== null;
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

            if (this.sock) {
                await this.destroy();
            }

            if (fs.existsSync(this.sessionPath)) {
                try {
                    fs.rmSync(this.sessionPath, { recursive: true, force: true });
                    console.log('✅ Session folder deleted');
                } catch (err) {
                    console.warn('⚠️ Error deleting session folder:', err);
                }
            }

            this.currentQRCode = null;
            this.isConnected = false;
            this.isInitialized = false;
            this.reconnectAttempts = 0;

            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.initialize();

            let attempts = 0;
            const maxAttempts = 30;
            while (!this.currentQRCode && attempts < maxAttempts && !this.isConnected) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }

            if (this.currentQRCode) {
                console.log('✅ QR code regenerated successfully');
            } else if (this.isConnected) {
                console.log('ℹ️ Client already connected, no QR code needed');
            } else {
                console.warn('⚠️ QR code not generated yet');
            }
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

        if (!cleaned || cleaned.length < 8) {
            throw new Error(`Invalid phone number: "${phone}" does not contain enough digits`);
        }

        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }

        if (!cleaned.startsWith('62')) {
            cleaned = '62' + cleaned;
        }

        if (cleaned.length < 10) {
            throw new Error(`Invalid phone number: "${phone}" results in invalid format`);
        }

        return cleaned + '@s.whatsapp.net';
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

            console.log(`📱 [Baileys] Sending message:`);
            console.log(`   Phone: ${formattedPhone}`);
            console.log(`   Length: ${message.length} chars`);

            const result = await this.sock!.sendMessage(formattedPhone, {
                text: message
            });

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
                messageId: result?.key?.id || 'unknown'
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

    static async destroy(): Promise<void> {
        if (this.sock) {
            try {
                await this.sock.logout();
                console.log('✅ Baileys WhatsApp client logged out');
            } catch (error) {
                console.warn('⚠️ Error during logout:', error);
            }

            this.sock = null;
            this.isInitialized = false;
            this.isConnected = false;
            this.currentQRCode = null;
            console.log('✅ Baileys WhatsApp client destroyed');
        }
    }
}
