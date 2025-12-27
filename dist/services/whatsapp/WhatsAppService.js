"use strict";
/**
 * Modern WhatsApp Service using Baileys (Multi-Device)
 * Replaces Puppeteer implementation for better stability
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
exports.WhatsAppService = void 0;
const qrcode = __importStar(require("qrcode-terminal"));
const pool_1 = require("../../db/pool");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
// Polyfill Web Crypto for Node.js < 19
if (!globalThis.crypto) {
    try {
        // @ts-ignore
        globalThis.crypto = crypto.webcrypto;
    }
    catch (e) {
        console.warn('⚠️ Failed to polyfill Web Crypto (Node version might be too old)');
    }
}
// Dynamic import wrapper for Baileys
let baileysModule = null;
// Helper to force native dynamic import (bypassing TS transpilation to require)
const dynamicImport = new Function('specifier', 'return import(specifier)');
async function loadBaileys() {
    if (!baileysModule) {
        baileysModule = await dynamicImport('@whiskeysockets/baileys');
    }
    return baileysModule;
}
class WhatsAppService {
    /**
     * Initialize Baileys WhatsApp client with dynamic import
     */
    static async initialize() {
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
            const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason, Browsers, downloadMediaMessage } = baileys;
            // Create Pino logger dynamically
            const pino = await dynamicImport('pino');
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
                printQRInTerminal: false, // We handle QR display manually or via frontend
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger)
                },
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                getMessage: async (key) => {
                    return { conversation: '' };
                }
            });
            console.log('✅ Baileys socket created');
            // Handle credentials update
            this.sock.ev.on('creds.update', saveCreds);
            // Handle connection updates
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    console.log('📱 QR Code generated');
                    qrcode.generate(qr, { small: true });
                    this.currentQRCode = qr;
                    this.isConnected = false;
                }
                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log('⚠️ Connection closed:', lastDisconnect?.error);
                    console.log(`   Should reconnect: ${shouldReconnect}`);
                    this.isConnected = false;
                    this.isInitialized = false;
                    this.isInitializing = false;
                    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`🔄 Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        // Re-initialize logic
                        // Note: calling initialize() recursively might cause stack issues if loops rapidly, 
                        // but with timeout it's fine.
                        // However, standard Baileys usually handles reconnects if we just recreate the socket.
                        await this.initialize();
                    }
                    else if (!shouldReconnect) {
                        console.log('🚪 Logged out. Please scan QR code again.');
                        this.currentQRCode = null;
                        this.reconnectAttempts = 0;
                    }
                    else {
                        console.error('❌ Max reconnection attempts reached');
                        this.currentQRCode = null; // Clear QR code so user knows to click "regenerate"
                    }
                }
                else if (connection === 'open') {
                    console.log('✅ WhatsApp connection opened successfully!');
                    this.isConnected = true;
                    this.isInitialized = true;
                    this.isInitializing = false;
                    this.currentQRCode = null;
                    this.reconnectAttempts = 0;
                }
                else if (connection === 'connecting') {
                    console.log('⏳ Connecting to WhatsApp...');
                }
            });
            // Handle incoming messages
            this.sock.ev.on('messages.upsert', async (m) => {
                const message = m.messages[0];
                if (!message.key.fromMe && m.type === 'notify') {
                    console.log('📩 New message received');
                    try {
                        const { WhatsAppBotService } = await Promise.resolve().then(() => __importStar(require('./WhatsAppBotService')));
                        // Construct Adapter for WhatsAppBotService
                        const from = message.key.remoteJid;
                        // Extract text body
                        let body = '';
                        if (message.message?.conversation) {
                            body = message.message.conversation;
                        }
                        else if (message.message?.extendedTextMessage?.text) {
                            body = message.message.extendedTextMessage.text;
                        }
                        else if (message.message?.imageMessage?.caption) {
                            body = message.message.imageMessage.caption;
                        }
                        // Check for media
                        const hasMedia = !!(message.message?.imageMessage ||
                            message.message?.videoMessage ||
                            message.message?.documentMessage);
                        const adapter = {
                            from: from,
                            body: body,
                            hasMedia: hasMedia,
                            downloadMedia: async () => {
                                const buffer = await downloadMediaMessage(message, 'buffer', {});
                                // Detect mime type
                                let mimetype = 'application/octet-stream';
                                if (message.message?.imageMessage)
                                    mimetype = message.message.imageMessage.mimetype;
                                else if (message.message?.videoMessage)
                                    mimetype = message.message.videoMessage.mimetype;
                                else if (message.message?.documentMessage)
                                    mimetype = message.message.documentMessage.mimetype;
                                return {
                                    mimetype,
                                    data: buffer.toString('base64'),
                                    filename: 'file'
                                };
                            }
                        };
                        console.log(`[Adapter] From: ${from}, Body: ${body}, Media: ${hasMedia}`);
                        await WhatsAppBotService.handleMessage(adapter);
                    }
                    catch (error) {
                        console.error('Error handling bot message:', error);
                    }
                }
            });
            this.isInitialized = true;
            this.isInitializing = false;
            console.log('✅ Baileys WhatsApp service initialized successfully');
        }
        catch (error) {
            this.isInitializing = false;
            this.isInitialized = false;
            console.error('❌ Failed to initialize Baileys WhatsApp service:');
            console.error('   Error:', error.message || error);
            throw error;
        }
    }
    static isClientReady() {
        return this.isConnected && this.sock !== null;
    }
    static getStatus() {
        return {
            ready: this.isConnected,
            initialized: this.isInitialized,
            initializing: this.isInitializing,
            authenticated: this.isConnected,
            hasQRCode: this.currentQRCode !== null
        };
    }
    static getQRCode() {
        return this.currentQRCode;
    }
    static async regenerateQRCode() {
        try {
            console.log('🔄 Regenerating QR code...');
            if (this.sock) {
                await this.destroy();
            }
            if (fs.existsSync(this.sessionPath)) {
                try {
                    fs.rmSync(this.sessionPath, { recursive: true, force: true });
                    console.log('✅ Session folder deleted');
                }
                catch (err) {
                    console.warn('⚠️ Error deleting session folder:', err);
                }
            }
            this.currentQRCode = null;
            this.isConnected = false;
            this.isInitialized = false;
            this.reconnectAttempts = 0;
            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.initialize();
            // Wait for QR
            let attempts = 0;
            const maxAttempts = 30; // 15s
            while (!this.currentQRCode && attempts < maxAttempts && !this.isConnected) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }
            if (this.currentQRCode) {
                console.log('✅ QR code regenerated successfully');
            }
            else if (this.isConnected) {
                console.log('ℹ️ Client already connected, no QR code needed');
            }
            else {
                console.warn('⚠️ QR code not generated yet');
            }
        }
        catch (error) {
            console.error('Failed to regenerate QR code:', error);
            throw error;
        }
    }
    static formatPhoneNumber(phone) {
        if (!phone || typeof phone !== 'string') {
            throw new Error('Invalid phone number: phone must be a non-empty string');
        }
        let cleaned = phone.replace(/\D/g, '');
        if (!cleaned || cleaned.length < 5) {
            // throw new Error(`Invalid phone number: "${phone}"`);
            // Be more lenient to avoid crashes on bad data
            console.warn(`Invalid phone number: "${phone}", cleaner: ${cleaned}`);
            if (!cleaned)
                return '';
        }
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }
        if (!cleaned.startsWith('62')) {
            cleaned = '62' + cleaned;
        }
        return cleaned + '@s.whatsapp.net';
    }
    static async sendMessage(phone, message, options = {}) {
        if (!this.isClientReady()) {
            const error = 'WhatsApp client is not ready. Please scan QR code first.';
            console.error('❌', error);
            await this.logNotification(options.customerId, phone, message, 'failed', error, options.template);
            return { success: false, error };
        }
        try {
            const formattedPhone = this.formatPhoneNumber(phone);
            // if invalid phone
            if (!formattedPhone) {
                return { success: false, error: 'Invalid phone number format' };
            }
            console.log(`📱 [Baileys] Sending message to ${formattedPhone}`);
            const result = await this.sock.sendMessage(formattedPhone, {
                text: message
            });
            console.log(`✅ WhatsApp message sent to ${phone}`);
            await this.logNotification(options.customerId, phone, message, 'sent', undefined, options.template);
            return {
                success: true,
                messageId: result?.key?.id || 'unknown'
            };
        }
        catch (error) {
            const errorMessage = error.message || 'Unknown error';
            console.error(`❌ Failed to send message:`, errorMessage);
            await this.logNotification(options.customerId, phone, message, 'failed', errorMessage, options.template);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    static async logNotification(customerId, recipient, message, status, errorMessage, template) {
        try {
            const [columns] = await pool_1.databasePool.query('SHOW COLUMNS FROM notification_logs');
            const columnNames = columns.map((col) => col.Field);
            let query;
            let params;
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
            }
            else {
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
            await pool_1.databasePool.query(query, params);
        }
        catch (error) {
            console.error('Failed to log notification:', error);
        }
    }
    static async getNotificationHistory(limit = 50, customerId, status) {
        try {
            let query = `SELECT id, customer_id, channel, recipient, template, message, status, 
                        error_message, sent_at, created_at
                        FROM notification_logs WHERE 1=1`;
            const params = [];
            if (this.channelColumnExists === null) {
                try {
                    await pool_1.databasePool.query('SELECT channel FROM notification_logs LIMIT 1');
                    this.channelColumnExists = true;
                }
                catch {
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
            const [rows] = await pool_1.databasePool.query(query, params);
            return rows;
        }
        catch (error) {
            console.error('Failed to get notification history:', error);
            return [];
        }
    }
    static async getNotificationStats() {
        try {
            let query = `SELECT COUNT(*) as total,
                        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
                        FROM notification_logs
                        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
            if (this.channelColumnExists === null) {
                try {
                    await pool_1.databasePool.query('SELECT channel FROM notification_logs LIMIT 1');
                    this.channelColumnExists = true;
                }
                catch {
                    this.channelColumnExists = false;
                }
            }
            if (this.channelColumnExists) {
                query = query.replace('WHERE created_at', "WHERE channel = 'whatsapp' AND created_at");
            }
            const [rows] = await pool_1.databasePool.query(query);
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
        }
        catch (error) {
            console.error('Failed to get notification stats:', error);
            return { total: 0, sent: 0, failed: 0, pending: 0, successRate: 0 };
        }
    }
    static async sendBulkMessages(recipients, delayMs = 2000) {
        console.log(`📱 [Bulk] Sending ${recipients.length} messages with ${delayMs}ms delay`);
        const results = [];
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
            }
            else {
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
    static async destroy() {
        if (this.sock) {
            try {
                // Baileys socket doesn't have a direct 'destroy' or 'logout' that is always safe
                // But end() or logout() usually works.
                // sock.end is not always available depending on version, check types or documentation?
                // Using socket reference `end` if available, or just logout.
                if (this.sock.logout)
                    await this.sock.logout();
                else if (this.sock.end)
                    this.sock.end();
                console.log('✅ Baileys WhatsApp client logged out/ended');
            }
            catch (error) {
                console.warn('⚠️ Error during logout:', error);
            }
            this.sock = null;
            this.isInitialized = false;
            this.isConnected = false;
            this.currentQRCode = null;
        }
    }
}
exports.WhatsAppService = WhatsAppService;
WhatsAppService.sock = null;
WhatsAppService.isInitialized = false;
WhatsAppService.isInitializing = false;
WhatsAppService.isConnected = false;
WhatsAppService.currentQRCode = null;
WhatsAppService.sessionPath = path.join(process.cwd(), 'baileys-session-new');
WhatsAppService.reconnectAttempts = 0;
WhatsAppService.maxReconnectAttempts = 5;
WhatsAppService.channelColumnExists = null;
//# sourceMappingURL=WhatsAppService.js.map