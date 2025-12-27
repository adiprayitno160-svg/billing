"use strict";
/**
 * Modern WhatsApp Service using WPPConnect
 * Stable, CommonJS compatible, and feature-rich
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
exports.WPPConnectWhatsAppService = void 0;
const wppconnect = __importStar(require("@wppconnect-team/wppconnect"));
const pool_1 = require("../../db/pool");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WPPConnectWhatsAppService {
    /**
     * Initialize WPPConnect WhatsApp client
     */
    static async initialize() {
        if (this.isInitialized) {
            console.log('✅ WPPConnect WhatsApp service already initialized');
            return;
        }
        if (this.isInitializing) {
            console.log('⏳ WPPConnect WhatsApp service is already initializing');
            return;
        }
        try {
            this.isInitializing = true;
            console.log('📱 Initializing WPPConnect WhatsApp service...');
            console.log(`   Session path: ${this.sessionPath}`);
            // Create session directory if doesn't exist
            if (!fs.existsSync(this.sessionPath)) {
                fs.mkdirSync(this.sessionPath, { recursive: true });
                console.log('✅ Session directory created');
            }
            // Create WPPConnect client
            this.client = await wppconnect.create({
                session: 'billing-session',
                catchQR: (base64Qr, asciiQR, attempts) => {
                    console.log('📱 QR Code generated (attempt', attempts, ')');
                    console.log(asciiQR);
                    this.currentQRCode = base64Qr;
                },
                statusFind: (statusSession, session) => {
                    console.log('📱 Status Session:', statusSession);
                    if (statusSession === 'qrReadSuccess') {
                        console.log('✅ QR Code scanned successfully!');
                        this.isConnected = true;
                        this.isInitialized = true;
                        this.currentQRCode = null;
                    }
                    else if (statusSession === 'isLogged') {
                        console.log('✅ Already logged in!');
                        this.isConnected = true;
                        this.isInitialized = true;
                        this.currentQRCode = null;
                    }
                    else if (statusSession === 'notLogged') {
                        console.log('⏳ Waiting for QR code scan...');
                        this.isConnected = false;
                    }
                    else if (statusSession === 'autocloseCalled') {
                        console.log('⚠️ Session auto-closed');
                        this.isConnected = false;
                        this.isInitialized = false;
                    }
                    else if (statusSession === 'desconnectedMobile') {
                        console.log('⚠️ Disconnected from mobile');
                        this.isConnected = false;
                    }
                },
                logQR: false,
                browserArgs: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ],
                headless: true,
                devtools: false,
                useChrome: false,
                debug: false,
                logLevel: 'error',
                autoClose: 60000,
                createPathFileToken: true,
                waitForLogin: true,
                puppeteerOptions: {
                    userDataDir: this.sessionPath,
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu'
                    ]
                }
            });
            console.log('✅ WPPConnect client created');
            // Handle connection events
            this.client.onStateChange((state) => {
                console.log('📱 State changed:', state);
                if (state === 'CONNECTED') {
                    this.isConnected = true;
                    this.isInitialized = true;
                    this.reconnectAttempts = 0;
                }
                else if (state === 'DISCONNECTED' || state === 'TIMEOUT') {
                    this.isConnected = false;
                    this.handleReconnect();
                }
            });
            // Handle incoming messages
            this.client.onMessage(async (message) => {
                if (!message.isGroupMsg && !message.fromMe) {
                    console.log('📩 New message received from:', message.from);
                    // Handle bot messages if needed
                }
            });
            this.isInitialized = true;
            this.isInitializing = false;
            console.log('✅ WPPConnect WhatsApp service initialized successfully');
        }
        catch (error) {
            this.isInitializing = false;
            this.isInitialized = false;
            console.error('❌ Failed to initialize WPPConnect WhatsApp service:');
            console.error('   Error:', error.message || error);
            throw error;
        }
    }
    static async handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            try {
                await this.initialize();
            }
            catch (error) {
                console.error('❌ Reconnection failed:', error);
            }
        }
        else {
            console.error('❌ Max reconnection attempts reached');
        }
    }
    static isClientReady() {
        return this.isConnected && this.client !== null;
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
            if (this.client) {
                try {
                    await this.client.close();
                }
                catch (err) {
                    console.warn('⚠️ Error closing client:', err);
                }
            }
            // Delete session tokens
            const tokenPath = path.join(this.sessionPath, 'billing-session.data.json');
            if (fs.existsSync(tokenPath)) {
                fs.unlinkSync(tokenPath);
                console.log('✅ Session token deleted');
            }
            this.currentQRCode = null;
            this.isConnected = false;
            this.isInitialized = false;
            this.isInitializing = false;
            this.client = null;
            this.reconnectAttempts = 0;
            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.initialize();
            console.log('✅ QR code regeneration initiated');
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
        return cleaned + '@c.us';
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
            console.log(`📱 [WPPConnect] Sending message:`);
            console.log(`   Phone: ${formattedPhone}`);
            console.log(`   Length: ${message.length} chars`);
            const result = await this.client.sendText(formattedPhone, message);
            console.log(`✅ WhatsApp message sent to ${phone}`);
            await this.logNotification(options.customerId, phone, message, 'sent', undefined, options.template);
            return {
                success: true,
                messageId: result?.id || 'unknown'
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
    /**
     * Send bulk messages with delay between each message
     */
    static async sendBulkMessages(recipients, delayMs = 2000) {
        console.log(`📱 [Bulk] Sending ${recipients.length} messages with ${delayMs}ms delay`);
        const results = [];
        let sent = 0;
        let failed = 0;
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            console.log(`📱 [Bulk] Sending ${i + 1}/${recipients.length} to ${recipient.phone}`);
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
        console.log(`✅ [Bulk] Complete: ${sent} sent, ${failed} failed`);
        return {
            total: recipients.length,
            sent,
            failed,
            results
        };
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
    static async destroy() {
        if (this.client) {
            try {
                await this.client.close();
                console.log('✅ WPPConnect WhatsApp client closed');
            }
            catch (error) {
                console.warn('⚠️ Error during close:', error);
            }
            this.client = null;
            this.isInitialized = false;
            this.isConnected = false;
            this.currentQRCode = null;
            console.log('✅ WPPConnect WhatsApp client destroyed');
        }
    }
}
exports.WPPConnectWhatsAppService = WPPConnectWhatsAppService;
WPPConnectWhatsAppService.client = null;
WPPConnectWhatsAppService.isInitialized = false;
WPPConnectWhatsAppService.isInitializing = false;
WPPConnectWhatsAppService.isConnected = false;
WPPConnectWhatsAppService.currentQRCode = null;
WPPConnectWhatsAppService.sessionPath = path.join(process.cwd(), 'wppconnect-session');
WPPConnectWhatsAppService.reconnectAttempts = 0;
WPPConnectWhatsAppService.maxReconnectAttempts = 5;
WPPConnectWhatsAppService.channelColumnExists = null;
//# sourceMappingURL=WPPConnectWhatsAppService.js.map