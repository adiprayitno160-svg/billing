/**
 * WhatsApp Service using Baileys
 * No Chromium/Puppeteer - Pure JavaScript WebSocket implementation
 * Compatible with old CPUs (Intel Atom D2500, etc)
 */

import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    useMultiFileAuthState,
    WAMessage,
    proto,
    jidNormalizedUser,
    downloadMediaMessage
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
// import { WhatsAppBotService } from './WhatsAppBotService'; // Removed to avoid circular dependency
import fs from 'fs';
import path from 'path';

export interface WhatsAppMessageOptions {
    customerId?: number;
    template?: string;
    priority?: 'low' | 'normal' | 'high';
}

export class WhatsAppServiceBaileys {
    private static sock: any = null;
    private static isInitialized = false;
    private static isInitializing = false;
    private static isConnected = false;
    private static currentQRCode: string | null = null;
    private static channelColumnExists: boolean | null = null;
    private static authDir = path.join(process.cwd(), 'baileys_auth');

    /**
     * Initialize WhatsApp Baileys client
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
            console.log('📱 Initializing WhatsApp Baileys service...');

            // Create auth directory if not exists
            if (!fs.existsSync(this.authDir)) {
                fs.mkdirSync(this.authDir, { recursive: true });
            }

            await this.startSocket();

        } catch (error: any) {
            this.isInitializing = false;
            this.isInitialized = false;
            console.error('❌ Failed to initialize WhatsApp service:', error.message || error);
            throw error;
        }
    }

    private static async startSocket() {
        try {
            // Fetch latest version of Baileys
            const { version, isLatest } = await fetchLatestBaileysVersion();
            console.log(`📱 Using Baileys version ${version.join('.')}, isLatest: ${isLatest}`);

            // Use multi-file auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

            // Create socket connection
            this.sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }), // silent logs
                printQRInTerminal: false, // We'll handle QR ourselves
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                markOnlineOnConnect: true
            });

            // Handle credentials update
            this.sock.ev.on('creds.update', saveCreds);

            // Handle connection updates
            this.sock.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;

                // QR code received
                if (qr) {
                    console.log('📱 QR Code generated');
                    qrcode.generate(qr, { small: true });
                    this.currentQRCode = qr;
                    this.isConnected = false;
                }

                // Connection opened
                if (connection === 'open') {
                    console.log('✅ WhatsApp connection opened successfully!');
                    this.isConnected = true;
                    this.isInitialized = true;
                    this.isInitializing = false;
                    this.currentQRCode = null;
                }

                // Connection closed
                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log('⚠️ WhatsApp connection closed:', lastDisconnect?.error);

                    if (shouldReconnect) {
                        console.log('🔄 Reconnecting...');
                        setTimeout(() => this.startSocket(), 3000);
                    } else {
                        console.log('🔌 Logged out, please scan QR code again');
                        this.isConnected = false;
                        this.isInitialized = false;
                    }
                }
            });

            // Handle incoming messages
            this.sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
                console.log(`[Baileys] 📩 messages.upsert event received - type: ${type}, count: ${messages?.length || 0}`);

                if (type !== 'notify') {
                    console.log(`[Baileys] ⏭️  Skipping - type is "${type}" (not "notify")`);
                    return;
                }

                for (const msg of messages) {
                    console.log(`[Baileys] 🔍 Processing message:`, {
                        hasMessage: !!msg.message,
                        fromMe: msg.key?.fromMe,
                        remoteJid: msg.key?.remoteJid
                    });

                    if (!msg.message) {
                        console.log(`[Baileys] ⏭️  Skipping - no message content`);
                        continue;
                    }
                    if (msg.key.fromMe) {
                        console.log(`[Baileys] ⏭️  Skipping - message from self`);
                        continue;
                    }

                    console.log(`[Baileys] ✅ Valid message received, calling handleIncomingMessage...`);
                    await this.handleIncomingMessage(msg);
                }
            });

            console.log('✅ WhatsApp Baileys service initialized successfully');

        } catch (error: any) {
            console.error('❌ Error starting socket:', error);
            throw error;
        }
    }

    private static async handleIncomingMessage(msg: WAMessage) {
        try {
            const from = msg.key.remoteJid || '';
            if (!from || !from.endsWith('@s.whatsapp.net')) return;

            console.log('📩 New message received from:', from);

            // Extract message text
            let messageText = '';
            if (msg.message?.conversation) {
                messageText = msg.message.conversation;
            } else if (msg.message?.extendedTextMessage?.text) {
                messageText = msg.message.extendedTextMessage.text;
            }

            // Check if has media
            const hasMedia = !!(
                msg.message?.imageMessage ||
                msg.message?.videoMessage ||
                msg.message?.documentMessage
            );

            console.log('[WhatsAppBaileys] From:', from);
            console.log('[WhatsAppBaileys] Body:', messageText?.substring(0, 100));
            console.log('[WhatsAppBaileys] Has Media:', hasMedia);

            // Create adapter for bot service
            const adapter = {
                from: from,
                body: messageText || '',
                hasMedia: hasMedia,
                downloadMedia: async () => {
                    if (!hasMedia) return null;

                    try {
                        const buffer = await downloadMediaMessage(
                            msg,
                            'buffer',
                            {},
                            {
                                logger: pino({ level: 'silent' }),
                                reuploadRequest: this.sock.updateMediaMessage
                            }
                        );

                        const messageType = Object.keys(msg.message || {})[0];
                        const mimeType = (msg.message as any)[messageType]?.mimetype || 'image/jpeg';

                        return {
                            mimetype: mimeType,
                            data: buffer.toString('base64'),
                            filename: (msg.message as any)[messageType]?.fileName || 'file'
                        };
                    } catch (error) {
                        console.error('[WhatsAppBaileys] Error downloading media:', error);
                        return null;
                    }
                }
            };

            console.log('[WhatsAppBaileys] Calling WhatsAppBotService.handleMessage()...');
            console.log('[WhatsAppBaileys] Calling WhatsAppBotService.handleMessage()...');
            const { WhatsAppBotService } = await import('./WhatsAppBotService');
            await WhatsAppBotService.handleMessage(adapter);
            console.log('[WhatsAppBaileys] ✅ Message handled successfully');

        } catch (error: any) {
            console.error('[WhatsAppBaileys] Error in message handler:', error);
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
        hasQRCode: boolean;
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

            if (!formattedPhone) {
                return { success: false, error: 'Invalid phone number format' };
            }

            console.log(`📱 [WhatsApp Baileys] Sending message to ${formattedPhone}`);

            const result = await this.sock.sendMessage(formattedPhone, { text: message });

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
        if (this.sock) {
            try {
                await this.sock.logout();
                console.log('✅ WhatsApp client destroyed');
            } catch (error) {
                console.warn('⚠️ Error during cleanup:', error);
            }

            this.sock = null;
            this.isInitialized = false;
            this.isInitializing = false; // Fix: Reset initializing flag
            this.isConnected = false;
            this.currentQRCode = null;
        }
    }
}
