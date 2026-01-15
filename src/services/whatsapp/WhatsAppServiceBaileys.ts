/**
 * WhatsApp Service using Baileys
 * "The Robust Version 2.1"
 * Features:
 * - Exponential Backoff Reconnection
 * - Active Keep-Alive / Watchdog
 * - Connection State Management
 * - Enhanced Error Handling
 * - Backward Compatibility for Controllers
 * - Bulk Messaging
 */

import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    useMultiFileAuthState,
    WAMessage,
    proto,
    jidNormalizedUser,
    downloadMediaMessage,
    Browsers
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
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
    private static authDir = path.join(process.cwd(), 'baileys_auth');

    // Robustness Stats
    private static connectionRetryCount = 0;
    private static readonly MAX_RETRIES = 100;
    private static readonly BASE_RETRY_DELAY_MS = 2000;
    private static readonly MAX_RETRY_DELAY_MS = 60000;

    // Keep-Alive
    private static pingInterval: NodeJS.Timeout | null = null;
    private static watchdogInterval: NodeJS.Timeout | null = null;
    private static lastActivityTimestamp = 0;

    // Instance ID for debug
    private static readonly INSTANCE_ID = Math.random().toString(36).substring(2, 6).toUpperCase();

    // Message Caches
    private static processedMessages: Set<string> = new Set();
    private static readonly MESSAGE_CACHE_TIMEOUT = 60000; // 1 minute

    /**
     * Initialize WhatsApp Baileys client
     */
    static async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.log(`[WA-${this.INSTANCE_ID}] ✅ WhatsApp service already initialized`);
            return;
        }

        if (this.isInitializing) {
            console.log(`[WA-${this.INSTANCE_ID}] ⏳ WhatsApp service is already initializing`);
            return;
        }

        try {
            this.isInitializing = true;
            console.log(`[WA-${this.INSTANCE_ID}] 🚀 Initializing WhatsApp Baileys service (Robust Mode)...`);

            // Check Auth Dir
            if (!fs.existsSync(this.authDir)) {
                fs.mkdirSync(this.authDir, { recursive: true });
            }

            // SELF-HEALING: Ensure DB Schema is correct automatically
            await this.ensureSchemaFixed();

            await this.connectToWhatsApp();

            // Start Watchdog immediately
            this.startWatchdog();

        } catch (error: any) {
            this.isInitializing = false;
            this.isInitialized = false;
            console.error(`[WA-${this.INSTANCE_ID}] ❌ Fatal initialization error:`, error);
            throw error;
        }
    }

    /**
     * Self-healing DB Schema
     */
    private static async ensureSchemaFixed(): Promise<void> {
        try {
            console.log(`[WA-${this.INSTANCE_ID}] 🔧 Checking/Fixing Database Schema...`);

            // Fix whatsapp_bot_messages
            try {
                await databasePool.query("ALTER TABLE whatsapp_bot_messages ADD COLUMN media_url TEXT NULL AFTER message_content");
                console.log(`[WA-${this.INSTANCE_ID}] ✅ Added media_url column`);
            } catch (e: any) { if (!e.message.includes('Duplicate')) console.log(`[WA-${this.INSTANCE_ID}] ℹ️ media_url check: ${e.message}`); }

            try {
                await databasePool.query("ALTER TABLE whatsapp_bot_messages ADD COLUMN status VARCHAR(20) DEFAULT 'processed' AFTER direction");
                console.log(`[WA-${this.INSTANCE_ID}] ✅ Added status column`);
            } catch (e: any) { if (!e.message.includes('Duplicate')) console.log(`[WA-${this.INSTANCE_ID}] ℹ️ status check: ${e.message}`); }

            // Fix notification_logs
            try {
                await databasePool.query("ALTER TABLE notification_logs ADD COLUMN channel VARCHAR(20) DEFAULT 'whatsapp' AFTER customer_id");
                console.log(`[WA-${this.INSTANCE_ID}] ✅ Added channel column`);
            } catch (e: any) { if (!e.message.includes('Duplicate')) console.log(`[WA-${this.INSTANCE_ID}] ℹ️ channel check: ${e.message}`); }

        } catch (error) {
            console.warn(`[WA-${this.INSTANCE_ID}] ⚠️ Schema fix warning:`, error);
        }
    }

    /**
     * Core Connection Logic with Retry Strategy
     */
    private static async connectToWhatsApp() {
        try {
            const { version, isLatest } = await fetchLatestBaileysVersion();
            console.log(`[WA-${this.INSTANCE_ID}] 📱 Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

            const sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                browser: Browsers.macOS('Desktop'),
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                markOnlineOnConnect: true,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 2000
            });

            this.sock = sock;

            // PAIRING CODE LOGIC - DISABLED TEMPORARILY TO FIX CONNECTION
            // Force QR Code mode for stability
            if (!sock.authState.creds.registered) {
                console.log(`[WA-${this.INSTANCE_ID}] 📷 Waiting for QR Code (QR Mode Enforced)...`);
                /*
                const phoneNumber = process.env.WA_BOT_NUMBER;
                if (phoneNumber) {
                    console.log(`[WA-${this.INSTANCE_ID}] 🔢 Pairing Code Mode Enabled. Number: ${phoneNumber}`);
                    setTimeout(async () => {
                        try {
                            const code = await sock.requestPairingCode(phoneNumber);
                            console.log(`\n\n[WA-${this.INSTANCE_ID}] 🔑 PAIRING CODE: ${code}\n\n`);
                        } catch (err) {
                            console.error(`[WA-${this.INSTANCE_ID}] ❌ Failed to request pairing code:`, err);
                        }
                    }, 3000);
                } else {
                    console.log(`[WA-${this.INSTANCE_ID}] 📷 Waiting for QR Code (No WA_BOT_NUMBER in env)...`);
                }
                */
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                this.lastActivityTimestamp = Date.now();

                // Force QR display
                if (qr) {
                    console.log(`[WA-${this.INSTANCE_ID}] 📷 QR Code generated!`);
                    console.log(`QR String: ${qr}`); // Log raw string for debugging
                    this.currentQRCode = qr;

                    // Attempt to print QR to terminal using qrcode-terminal if available
                    try {
                        qrcode.generate(qr, { small: true });
                    } catch (e) {
                        console.log('Could not print QR to terminal, please view in web settings');
                    }

                    this.isConnected = false;
                    this.isInitialized = false;
                }

                if (connection === 'close') {
                    this.isConnected = false;
                    this.currentQRCode = null;
                    const error = (lastDisconnect?.error as Boom)?.output;
                    const statusCode = error?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    console.log(`[WA-${this.INSTANCE_ID}] 🔌 Connection closed. Status: ${statusCode}`);

                    if (shouldReconnect) {
                        this.handleReconnection();
                    } else {
                        console.log(`[WA-${this.INSTANCE_ID}] 🛑 Logged out. Cleaning up session...`);
                        await this.clearSession();
                        this.isInitialized = false;
                        setTimeout(() => this.initialize(), 5000);
                    }
                }

                if (connection === 'open') {
                    console.log(`[WA-${this.INSTANCE_ID}] ✅ Connection opened successfully!`);
                    this.isConnected = true;
                    this.isInitialized = true;
                    this.isInitializing = false;
                    this.currentQRCode = null;
                    this.connectionRetryCount = 0;

                    this.startPingMechanism();
                }
            });

            sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type !== 'notify') return;

                for (const msg of messages) {
                    try {
                        if (!msg.message || msg.key.fromMe) continue;

                        const messageId = msg.key.id;
                        if (messageId && this.processedMessages.has(messageId)) continue;
                        if (messageId) {
                            this.processedMessages.add(messageId);
                            setTimeout(() => this.processedMessages.delete(messageId), this.MESSAGE_CACHE_TIMEOUT);
                        }

                        this.lastActivityTimestamp = Date.now();
                        await this.handleIncomingMessage(msg);

                    } catch (e) {
                        console.error(`[WA-${this.INSTANCE_ID}] ❌ Error processing message:`, e);
                    }
                }
            });

        } catch (error) {
            console.error(`[WA-${this.INSTANCE_ID}] ❌ Connection setup failed:`, error);
            this.handleReconnection();
        }
    }

    private static handleReconnection() {
        this.connectionRetryCount++;
        const delay = Math.min(
            this.BASE_RETRY_DELAY_MS * Math.pow(1.5, this.connectionRetryCount),
            this.MAX_RETRY_DELAY_MS
        );

        console.log(`[WA-${this.INSTANCE_ID}] 🔄 Reconnecting... Attempt ${this.connectionRetryCount}. Waiting ${delay}ms`);

        setTimeout(() => {
            this.connectToWhatsApp();
        }, delay);
    }

    private static startPingMechanism() {
        if (this.pingInterval) clearInterval(this.pingInterval);

        this.pingInterval = setInterval(async () => {
            if (!this.isConnected || !this.sock) return;

            try {
                const idleTime = Date.now() - this.lastActivityTimestamp;
                if (idleTime > 60000) {
                    await this.sock.sendPresenceUpdate('available');
                }
            } catch (e) {
                console.warn(`[WA-${this.INSTANCE_ID}] ⚠️ Keep-Alive failed:`, e);
            }
        }, 60000);
    }

    private static startWatchdog() {
        if (this.watchdogInterval) clearInterval(this.watchdogInterval);

        this.watchdogInterval = setInterval(() => {
            const now = Date.now();
            const lastActivityAgo = now - this.lastActivityTimestamp;

            if (this.isConnected && lastActivityAgo > 5 * 60 * 1000) {
                console.warn(`[WA-${this.INSTANCE_ID}] 🐕 Watchdog Bark! No activity for 5 minutes. Checking connection...`);
                if (this.sock?.ws?.readyState !== 1) {
                    console.error(`[WA-${this.INSTANCE_ID}] 🐕 Watchdog Bite! Socket is not open. Forcing reconnect.`);
                    this.destroy();
                    this.handleReconnection();
                }
            }
        }, 60000);
    }

    private static async clearSession() {
        try {
            if (fs.existsSync(this.authDir)) {
                fs.rmSync(this.authDir, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('Error clearing session:', e);
        }
    }

    static async destroy() {
        try {
            if (this.sock) {
                this.sock.end(undefined);
                this.sock = undefined;
            }
            if (this.pingInterval) clearInterval(this.pingInterval);
            this.isConnected = false;
        } catch (e) {
            console.error('Error destroying socket:', e);
        }
    }

    private static async handleIncomingMessage(msg: WAMessage) {
        try {
            // Self-message check (ignore)
            if (msg.key.fromMe) return;

            let senderJid = msg.key.remoteJid || '';
            const isGroup = senderJid.endsWith('@g.us');
            const isStatus = senderJid === 'status@broadcast';

            if (isStatus) return;

            // Handle LID (Linked Device ID)
            // If sender is a LID (e.g., 637...@lid), we need to handle it carefully.
            // For now, we will try to use the participant ID if available (in groups),
            // or rely on Baileys to handle the reply destination.
            // But for DATABASE LOOKUP, we need the clean phone number.

            // NOTE: LID numbers are NOT the phone number.
            // If we receive from LID, we might not be able to map to a customer unless we have an LID map.
            // However, usually in 1:1 chat, remoteJid is the user.

            // Improved log
            console.log(`[WA-${this.INSTANCE_ID}] 📨 Raw RemoteJID: ${senderJid}`);

            // If it is an LID, try to strip suffixes, but LID digits != Phone digits.
            // We just proceed, but user must register the LID if it persists, OR we advise user to chat from main device.
            // But usually, Baileys handles this? No, we receive what WA sends.

            let m = msg.message;
            if (!m) return;

            // Unwrap ephemeral/viewOnce messages
            if (m.ephemeralMessage) m = m.ephemeralMessage.message!;
            if (m.viewOnceMessage) m = m.viewOnceMessage.message!;
            if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message!;
            if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message!;

            const type = Object.keys(m || {})[0];
            let body = '';

            console.log(`[WA-${this.INSTANCE_ID}] 📨 Processing message type: ${type}`);

            if (type === 'conversation') body = m?.conversation || '';
            else if (type === 'extendedTextMessage') body = m?.extendedTextMessage?.text || '';
            else if (type === 'imageMessage') body = m?.imageMessage?.caption || '';
            else if (type === 'videoMessage') body = m?.videoMessage?.caption || '';
            else if (type === 'documentMessage') body = m?.documentMessage?.caption || '';


            const hasMedia = !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage);

            const adapter = {
                from: senderJid, // FIX: Use senderJid instead of undefined 'from'
                body: body,
                hasMedia: hasMedia,
                fromMe: msg.key.fromMe || false,
                downloadMedia: async () => {
                    if (!hasMedia) return null;
                    const buffer = await downloadMediaMessage(
                        msg,
                        'buffer',
                        {},
                        {
                            logger: pino({ level: 'silent' }),
                            reuploadRequest: this.sock.updateMediaMessage
                        }
                    ) as Buffer;

                    const mime = (msg.message as any)[type]?.mimetype || 'application/octet-stream';

                    return {
                        mimetype: mime,
                        data: buffer.toString('base64'),
                        filename: 'file'
                    };
                }
            };

            const { WhatsAppBotService } = await import('./WhatsAppBotService');
            await WhatsAppBotService.handleMessage(adapter);

        } catch (e) {
            console.error(`[WA-${this.INSTANCE_ID}] ❌ Message Handler Error:`, e);
        }
    }

    static async sendMessage(phone: string, message: string, options: WhatsAppMessageOptions = {}): Promise<{ success: boolean; messageId?: string; error?: string }> {
        if (!this.isConnected || !this.sock) {
            return { success: false, error: 'WhatsApp not connected' };
        }

        try {
            const jid = this.formatToJid(phone);
            const result = await this.sock.sendMessage(jid, { text: message });

            await this.logNotification(options.customerId, phone, message, 'sent', undefined, options.template);

            return { success: true, messageId: result?.key?.id };
        } catch (e: any) {
            console.error(`[WA-${this.INSTANCE_ID}] ❌ Send Message Fail:`, e);
            await this.logNotification(options.customerId, phone, message, 'failed', e.message, options.template);
            return { success: false, error: e.message };
        }
    }

    /**
     * Send presence update (typing, recording, available, unavailable)
     */
    static async sendPresenceUpdate(jid: string, type: 'composing' | 'recording' | 'available' | 'unavailable'): Promise<void> {
        if (!this.isConnected || !this.sock) return;
        try {
            await this.sock.sendPresenceUpdate(type, jid);
        } catch (error) {
            console.warn(`[WA-${this.INSTANCE_ID}] Failed to send presence update:`, error);
        }
    }

    static async sendImage(phone: string, imagePath: string, caption?: string, options: WhatsAppMessageOptions = {}): Promise<{ success: boolean; messageId?: string; error?: string }> {
        if (!this.isConnected || !this.sock) return { success: false, error: 'Not connected' };

        try {
            const jid = this.formatToJid(phone);
            const buffer = fs.readFileSync(imagePath);
            const result = await this.sock.sendMessage(jid, { image: buffer, caption: caption });

            await this.logNotification(options.customerId, phone, caption || '[Image]', 'sent', undefined, options.template);
            return { success: true, messageId: result?.key?.id };
        } catch (e: any) {
            console.error(`[WA-${this.INSTANCE_ID}] ❌ Send Image Fail:`, e);
            return { success: false, error: e.message };
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
        console.log(`[WA-${this.INSTANCE_ID}] 📱 [Bulk] Sending ${recipients.length} messages`);
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
                results.push({ phone: recipient.phone, success: false, error: result.error });
            }

            if (i < recipients.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        return { total: recipients.length, sent, failed, results };
    }

    static isClientReady(): boolean {
        return this.isConnected;
    }

    static getQRCode(): string | null {
        return this.currentQRCode;
    }

    static getStatus() {
        return {
            ready: this.isConnected,
            initialized: this.isInitialized,
            initializing: this.isInitializing,
            hasQRCode: !!this.currentQRCode,
            authenticated: this.isConnected
        };
    }

    static async regenerateQRCode(): Promise<void> {
        console.log(`[WA-${this.INSTANCE_ID}] 🔄 Force refreshing session for QR...`);
        await this.destroy();
        await this.clearSession();
        this.isInitialized = false;
        setTimeout(() => this.initialize(), 1000);
    }

    static async getNotificationStats(): Promise<{ total: number; sent: number; failed: number; pending: number; successRate: number }> {
        try {
            // simplified robust query
            const [rows] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                FROM notification_logs WHERE channel = 'whatsapp' AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
             `);
            const r = rows[0];
            const total = r?.total || 0;
            const sent = r?.sent || 0;
            return {
                total: total,
                sent: sent,
                failed: r?.failed || 0,
                pending: 0,
                successRate: total > 0 ? (sent / total) * 100 : 0
            };
        } catch (e) {
            return { total: 0, sent: 0, failed: 0, pending: 0, successRate: 0 };
        }
    }

    static async getNotificationHistory(limit: number = 50, customerId?: number, status?: string): Promise<any[]> {
        try {
            let query = `SELECT * FROM notification_logs WHERE channel = 'whatsapp'`;
            const params: any[] = [];

            if (customerId) {
                query += ` AND customer_id = ?`;
                params.push(customerId);
            }
            if (status) {
                query += ` AND status = ?`;
                params.push(status);
            }

            query += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);

            const [rows] = await databasePool.query<RowDataPacket[]>(query, params);
            return rows;
        } catch (e) {
            return [];
        }
    }

    private static formatToJid(phone: string): string {
        let clean = phone.replace(/\D/g, '');
        if (clean.startsWith('0')) clean = '62' + clean.slice(1);
        if (!clean.includes('@')) clean += '@s.whatsapp.net';
        return clean;
    }

    private static async logNotification(customerId: number | undefined, recipient: string, message: string, status: string, error?: string, template?: string) {
        try {
            const query = `INSERT INTO notification_logs (customer_id, channel, recipient, message, status, error_message, created_at, sent_at) VALUES (?, 'whatsapp', ?, ?, ?, ?, NOW(), ?)`;
            await databasePool.query(query, [customerId || null, recipient, message, status, error || null, status === 'sent' ? new Date() : null]);
        } catch (e) {
            console.error('Failed to log notification:', e);
        }
    }
}
