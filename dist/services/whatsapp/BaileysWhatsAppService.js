"use strict";
/**
 * Modern WhatsApp Service using Baileys (Multi-Device)
 * More stable and reliable than whatsapp-web.js
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysWhatsAppService = void 0;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const qrcode = __importStar(require("qrcode-terminal"));
const pino_1 = __importDefault(require("pino"));
const pool_1 = require("../../db/pool");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class BaileysWhatsAppService {
    /**
     * Initialize Baileys WhatsApp client
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
            // Create session directory if doesn't exist
            if (!fs.existsSync(this.sessionPath)) {
                fs.mkdirSync(this.sessionPath, { recursive: true });
                console.log('✅ Session directory created');
            }
            // Load auth state
            const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(this.sessionPath);
            console.log('✅ Auth state loaded');
            // Get latest Baileys version
            const { version, isLatest } = await (0, baileys_1.fetchLatestBaileysVersion)();
            console.log(`📱 Using WA v${version.join('.')}, isLatest: ${isLatest}`);
            // Create socket
            this.sock = (0, baileys_1.default)({
                version,
                logger: this.logger,
                printQRInTerminal: false, // We'll handle QR manually
                auth: {
                    creds: state.creds,
                    keys: (0, baileys_1.makeCacheableSignalKeyStore)(state.keys, this.logger)
                },
                browser: baileys_1.Browsers.ubuntu('Chrome'), // Identify as desktop browser
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                getMessage: async (key) => {
                    // Message history handler (optional)
                    return { conversation: '' };
                }
            });
            console.log('✅ Baileys socket created');
            // Handle credentials update (save to session)
            this.sock.ev.on('creds.update', saveCreds);
            // Handle connection updates
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                // Handle QR code
                if (qr) {
                    console.log('📱 QR Code generated');
                    qrcode.generate(qr, { small: true });
                    this.currentQRCode = qr;
                    this.isConnected = false;
                }
                // Handle connection status
                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== baileys_1.DisconnectReason.loggedOut;
                    console.log('⚠️ Connection closed:', lastDisconnect?.error);
                    console.log(`   Should reconnect: ${shouldReconnect}`);
                    this.isConnected = false;
                    this.isInitialized = false;
                    this.isInitializing = false;
                    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`🔄 Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                        // Wait before reconnecting
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        await this.initialize();
                    }
                    else if (!shouldReconnect) {
                        console.log('🚪 Logged out. Please scan QR code again.');
                        this.currentQRCode = null;
                    }
                    else {
                        console.error('❌ Max reconnection attempts reached');
                    }
                }
                else if (connection === 'open') {
                    console.log('✅ WhatsApp connection opened successfully!');
                    this.isConnected = true;
                    this.isInitialized = true;
                    this.isInitializing = false;
                    this.currentQRCode = null; // Clear QR after connection
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
                    console.log('📩 New message received:', message);
                    // Handle bot messages here if needed
                    try {
                        const { WhatsAppBotService } = await Promise.resolve().then(() => __importStar(require('./WhatsAppBotService')));
                        // Convert Baileys message to compatible format if needed
                        // await WhatsAppBotService.handleBaileysMessage(message);
                    }
                    catch (error) {
                        console.error('Error handling bot message:', error);
                    }
                }
            });
            this.isInitialized = true;
            this.isInitializing = false;
            console.log('✅ Baileys WhatsApp service initialized successfully');
            console.log('   Waiting for connection or QR code...');
        }
        catch (error) {
            this.isInitializing = false;
            this.isInitialized = false;
            console.error('❌ Failed to initialize Baileys WhatsApp service:');
            console.error('   Error:', error.message || error);
            console.error('   Stack:', error.stack);
            throw error;
        }
    }
    /**
     * Check if WhatsApp is ready
     */
    static isClientReady() {
        return this.isConnected && this.sock !== null;
    }
    /**
     * Get connection status
     */
    static getStatus() {
        return {
            ready: this.isConnected,
            initialized: this.isInitialized,
            initializing: this.isInitializing,
            authenticated: this.isConnected,
            hasQRCode: this.currentQRCode !== null
        };
    }
    /**
     * Get current QR code
     */
    static getQRCode() {
        return this.currentQRCode;
    }
    /**
     * Regenerate QR code
     */
    static async regenerateQRCode() {
        try {
            console.log('🔄 Regenerating QR code...');
            // Destroy existing connection
            if (this.sock) {
                await this.destroy();
            }
            // Delete session folder
            if (fs.existsSync(this.sessionPath)) {
                try {
                    fs.rmSync(this.sessionPath, { recursive: true, force: true });
                    console.log('✅ Session folder deleted');
                }
                catch (err) {
                    console.warn('⚠️ Error deleting session folder:', err);
                }
            }
            // Reset state
            this.currentQRCode = null;
            this.isConnected = false;
            this.isInitialized = false;
            this.reconnectAttempts = 0;
            // Wait before reinitializing
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Reinitialize
            await this.initialize();
            // Wait for QR code
            let attempts = 0;
            const maxAttempts = 30;
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
    /**
     * Format phone number to WhatsApp format
     */
    static formatPhoneNumber(phone) {
        if (!phone || typeof phone !== 'string') {
            throw new Error('Invalid phone number: phone must be a non-empty string');
        }
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');
        if (!cleaned || cleaned.length < 8) {
            throw new Error(`Invalid phone number: "${phone}" does not contain enough digits`);
        }
        // Handle Indonesian numbers
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
    /**
     * Send WhatsApp message
     */
    static async sendMessage(phone, message, options = {}) {
        if (!this.isClientReady()) {
            const error = 'WhatsApp client is not ready. Please scan QR code first.';
            console.error('❌', error);
            await this.logNotification(options.customerId, phone, message, 'failed', error, options.template);
            return { success: false, error };
        }
        try {
            const formattedPhone = this.formatPhoneNumber(phone);
            console.log(`📱 [Baileys] Sending message:`);
            console.log(`   Original phone: ${phone}`);
            console.log(`   Formatted phone: ${formattedPhone}`);
            console.log(`   Message length: ${message.length} chars`);
            // Send message using Baileys
            const result = await this.sock.sendMessage(formattedPhone, {
                text: message
            });
            console.log(`✅ WhatsApp message sent to ${phone}`);
            console.log(`   Message ID: ${result?.key?.id}`);
            await this.logNotification(options.customerId, phone, message, 'sent', undefined, options.template);
            return {
                success: true,
                messageId: result?.key?.id || 'unknown'
            };
        }
        catch (error) {
            const errorMessage = error.message || 'Unknown error';
            console.error(`❌ Failed to send WhatsApp message to ${phone}:`, errorMessage);
            await this.logNotification(options.customerId, phone, message, 'failed', errorMessage, options.template);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Send WhatsApp message with media
     */
    static async sendMessageWithMedia(phone, message, mediaPath, options = {}) {
        if (!this.isClientReady()) {
            const error = 'WhatsApp client is not ready. Please scan QR code first.';
            console.error('❌', error);
            return { success: false, error };
        }
        try {
            const formattedPhone = this.formatPhoneNumber(phone);
            // Read media file
            const mediaBuffer = fs.readFileSync(mediaPath);
            const mimeType = this.getMimeType(mediaPath);
            const result = await this.sock.sendMessage(formattedPhone, {
                image: mediaBuffer,
                caption: message,
                mimetype: mimeType
            });
            console.log(`✅ WhatsApp message with media sent to ${phone}`);
            await this.logNotification(options.customerId, phone, message, 'sent', undefined, options.template);
            return {
                success: true,
                messageId: result?.key?.id || 'unknown'
            };
        }
        catch (error) {
            const errorMessage = error.message || 'Unknown error';
            console.error(`❌ Failed to send WhatsApp message with media:`, errorMessage);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Get MIME type from file path
     */
    static getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
    /**
     * Send bulk messages
     */
    static async sendBulkMessages(recipients, delayMs = 2000) {
        const results = [];
        let successCount = 0;
        let failedCount = 0;
        for (const recipient of recipients) {
            const result = await this.sendMessage(recipient.phone, recipient.message, {
                customerId: recipient.customerId
            });
            results.push({
                phone: recipient.phone,
                success: result.success,
                error: result.error
            });
            if (result.success) {
                successCount++;
            }
            else {
                failedCount++;
            }
            // Delay between messages
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        return {
            success: successCount,
            failed: failedCount,
            results
        };
    }
    /**
     * Log notification to database
     */
    static async logNotification(customerId, recipient, message, status, errorMessage, template) {
        try {
            let query;
            let params;
            try {
                const [columns] = await pool_1.databasePool.query('SHOW COLUMNS FROM notification_logs');
                const columnNames = columns.map((col) => col.Field);
                if (columnNames.includes('channel')) {
                    query = `
                        INSERT INTO notification_logs 
                        (customer_id, channel, recipient, template, message, status, error_message, sent_at, created_at)
                        VALUES (?, 'whatsapp', ?, ?, ?, ?, ?, ?, NOW())
                    `;
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
                    query = `
                        INSERT INTO notification_logs 
                        (customer_id, message, status, sent_at, created_at)
                        VALUES (?, ?, ?, ?, NOW())
                    `;
                    params = [
                        customerId || null,
                        message,
                        status,
                        status === 'sent' ? new Date() : null
                    ];
                }
            }
            catch (checkError) {
                query = `
                    INSERT INTO notification_logs 
                    (customer_id, message, status, sent_at, created_at)
                    VALUES (?, ?, ?, ?, NOW())
                `;
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
            console.error('Failed to log notification to database:', error);
        }
    }
    /**
     * Get notification history
     */
    static async getNotificationHistory(limit = 50, customerId, status) {
        try {
            let query = `
                SELECT 
                    id,
                    customer_id,
                    channel,
                    recipient,
                    template,
                    message,
                    status,
                    error_message,
                    sent_at,
                    created_at
                FROM notification_logs
                WHERE 1=1
            `;
            const params = [];
            // Check if channel column exists
            if (this.channelColumnExists === null) {
                try {
                    const [testRows] = await pool_1.databasePool.query('SELECT channel FROM notification_logs LIMIT 1');
                    this.channelColumnExists = true;
                }
                catch (err) {
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
    /**
     * Get notification statistics
     */
    static async getNotificationStats() {
        try {
            let query = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
                FROM notification_logs
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `;
            if (this.channelColumnExists === null) {
                try {
                    const [testRows] = await pool_1.databasePool.query('SELECT channel FROM notification_logs LIMIT 1');
                    this.channelColumnExists = testRows.length > 0;
                }
                catch (err) {
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
    /**
     * Destroy WhatsApp client
     */
    static async destroy() {
        if (this.sock) {
            try {
                await this.sock.logout();
                console.log('✅ Baileys WhatsApp client logged out');
            }
            catch (error) {
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
exports.BaileysWhatsAppService = BaileysWhatsAppService;
BaileysWhatsAppService.sock = null;
BaileysWhatsAppService.isInitialized = false;
BaileysWhatsAppService.isInitializing = false;
BaileysWhatsAppService.isConnected = false;
BaileysWhatsAppService.currentQRCode = null;
BaileysWhatsAppService.sessionPath = path.join(process.cwd(), 'baileys-session');
BaileysWhatsAppService.reconnectAttempts = 0;
BaileysWhatsAppService.maxReconnectAttempts = 5;
BaileysWhatsAppService.channelColumnExists = null;
// Pino logger with minimal output
BaileysWhatsAppService.logger = (0, pino_1.default)({
    level: process.env.NODE_ENV === 'production' ? 'silent' : 'error'
});
//# sourceMappingURL=BaileysWhatsAppService.js.map