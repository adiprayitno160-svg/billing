"use strict";
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
exports.getWhatsAppBusinessService = getWhatsAppBusinessService;
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode = __importStar(require("qrcode-terminal"));
const pool_1 = require("../../db/pool");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class WhatsAppBusinessService {
    constructor() {
        this.client = null;
        this.qrCode = null;
        this.status = {
            connected: false,
            ready: false,
            authenticated: false
        };
        // Session path untuk menyimpan autentikasi
        const sessionDir = path_1.default.join(process.cwd(), 'whatsapp-session', 'whatsapp-business');
        if (!fs_1.default.existsSync(sessionDir)) {
            fs_1.default.mkdirSync(sessionDir, { recursive: true });
        }
        this.sessionPath = sessionDir;
    }
    /**
     * Initialize WhatsApp client
     */
    async initialize() {
        if (this.client) {
            return;
        }
        this.client = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth({
                dataPath: this.sessionPath
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
                    '--single-process',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-blink-features=AutomationControlled'
                ],
                ignoreHTTPSErrors: true,
                timeout: 60000
            }
        });
        // Event: QR Code
        this.client.on('qr', (qr) => {
            this.qrCode = qr;
            console.log('📱 QR Code generated:', qr.substring(0, 50) + '...');
            qrcode.generate(qr, { small: true });
            // Reset status when QR is generated
            this.status.connected = true;
            this.status.ready = false;
            this.status.authenticated = false;
        });
        // Event: Ready
        this.client.on('ready', () => {
            this.status.ready = true;
            this.status.connected = true;
            this.status.authenticated = true;
            if (this.client) {
                this.client.getState().then((state) => {
                    console.log('✅ WhatsApp Business Client is ready!');
                    console.log('State:', state);
                }).catch((err) => {
                    console.error('Error getting state:', err);
                });
                // Get phone number
                if (this.client.info) {
                    this.client.info.then((info) => {
                        if (info && info.wid) {
                            this.status.phoneNumber = info.wid.user;
                        }
                    }).catch((err) => {
                        console.error('Error getting info:', err);
                    });
                }
            }
        });
        // Event: Authenticated
        this.client.on('authenticated', () => {
            this.status.authenticated = true;
            console.log('✅ WhatsApp authenticated');
        });
        // Event: Authentication Failure
        this.client.on('auth_failure', (msg) => {
            this.status.authenticated = false;
            this.status.ready = false;
            console.error('❌ Authentication failure:', msg);
        });
        // Event: Disconnected
        this.client.on('disconnected', (reason) => {
            this.status.connected = false;
            this.status.ready = false;
            this.qrCode = null;
            console.log('⚠️ WhatsApp disconnected:', reason);
        });
        // Event: Loading Screen
        this.client.on('loading_screen', (percent, message) => {
            console.log(`🔄 Loading: ${percent}% - ${message}`);
        });
        // Event: Change State
        this.client.on('change_state', (state) => {
            console.log(`🔄 State changed: ${state}`);
            if (state === 'CONNECTING') {
                this.status.connected = false;
                this.status.ready = false;
            }
        });
        // Event: Message
        this.client.on('message', async (msg) => {
            // Handle incoming messages if needed
            console.log('📨 Received message:', msg.from, msg.body);
        });
        try {
            await this.client.initialize();
        }
        catch (error) {
            console.error('❌ Error initializing WhatsApp client:', error);
            this.status.connected = false;
            this.status.ready = false;
            this.status.authenticated = false;
            throw error;
        }
    }
    /**
     * Start WhatsApp client
     */
    async start() {
        try {
            // If client exists but not ready, destroy it first
            if (this.client && !this.status.ready) {
                try {
                    await this.client.destroy();
                }
                catch (destroyError) {
                    console.error('Error destroying existing client:', destroyError);
                }
                this.client = null;
            }
            // Reset status and QR code
            this.qrCode = null;
            this.status.connected = false;
            this.status.ready = false;
            this.status.authenticated = false;
            // Initialize new client
            if (!this.client) {
                await this.initialize();
            }
            else {
                // Re-initialize if client exists
                await this.client.initialize();
            }
            console.log('✅ WhatsApp client initialization started');
        }
        catch (error) {
            console.error('❌ Error starting WhatsApp client:', error);
            // Clean up on error
            if (this.client) {
                try {
                    await this.client.destroy();
                }
                catch (destroyError) {
                    console.error('Error destroying client:', destroyError);
                }
                this.client = null;
            }
            this.status.connected = false;
            this.status.ready = false;
            this.status.authenticated = false;
            this.qrCode = null;
            throw error;
        }
    }
    /**
     * Stop WhatsApp client
     */
    async stop() {
        if (this.client) {
            await this.client.destroy();
            this.client = null;
            this.status = {
                connected: false,
                ready: false,
                authenticated: false
            };
            this.qrCode = null;
        }
    }
    /**
     * Restart WhatsApp client
     */
    async restart() {
        await this.stop();
        await this.start();
    }
    /**
     * Get current status
     */
    getStatus() {
        // Return current status without async operations
        // Async operations will update status in event handlers
        return {
            ...this.status,
            qrCode: this.qrCode || undefined
        };
    }
    /**
     * Get QR Code
     */
    getQRCode() {
        return this.qrCode;
    }
    /**
     * Format phone number (Indonesia)
     */
    formatPhoneNumber(phone) {
        // Remove non-digit characters
        let cleaned = phone.replace(/\D/g, '');
        // Convert 0xxx to 62xxx
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }
        // Ensure starts with 62
        if (!cleaned.startsWith('62')) {
            cleaned = '62' + cleaned;
        }
        return cleaned + '@c.us';
    }
    /**
     * Send message to phone number
     */
    async sendMessage(phone, message) {
        if (!this.client || !this.status.ready) {
            return {
                success: false,
                error: 'WhatsApp client is not ready'
            };
        }
        try {
            const formattedPhone = this.formatPhoneNumber(phone);
            const result = await this.client.sendMessage(formattedPhone, message);
            // Log to database
            await this.logNotification(null, phone, message, true, result.id._serialized);
            return {
                success: true,
                messageId: result.id._serialized
            };
        }
        catch (error) {
            const errorMessage = error.message || 'Unknown error';
            // Log error to database
            await this.logNotification(null, phone, message, false, null, errorMessage);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Send message to customer by ID
     */
    async sendToCustomer(customerId, message) {
        try {
            // Get customer phone from database
            const [rows] = await pool_1.databasePool.execute('SELECT phone, name, customer_code FROM customers WHERE id = ?', [customerId]);
            if (rows.length === 0) {
                return {
                    success: false,
                    error: 'Customer not found'
                };
            }
            const customer = rows[0];
            if (!customer.phone) {
                return {
                    success: false,
                    error: 'Customer phone number not found'
                };
            }
            // Replace placeholders in message
            let formattedMessage = message
                .replace(/{name}/g, customer.name || '')
                .replace(/{customer_code}/g, customer.customer_code || '');
            const result = await this.sendMessage(customer.phone, formattedMessage);
            // Update log with customer ID
            if (result.success) {
                await pool_1.databasePool.execute('UPDATE whatsapp_notifications SET customer_id = ? WHERE message_id = ?', [customerId, result.messageId]);
            }
            return result;
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Unknown error'
            };
        }
    }
    /**
     * Send message to multiple customers
     */
    async sendToMultiple(customerIds, message) {
        const results = [];
        let success = 0;
        let failed = 0;
        for (const customerId of customerIds) {
            const result = await this.sendToCustomer(customerId, message);
            results.push({ customerId, ...result });
            if (result.success) {
                success++;
            }
            else {
                failed++;
            }
        }
        return { success, failed, results };
    }
    /**
     * Check if phone number is registered on WhatsApp
     */
    async checkNumber(phone) {
        if (!this.client || !this.status.ready) {
            return { isWhatsApp: false };
        }
        try {
            const formattedPhone = this.formatPhoneNumber(phone);
            const numberId = await this.client.getNumberId(formattedPhone);
            return {
                isWhatsApp: numberId !== null,
                number: numberId ? formattedPhone : undefined
            };
        }
        catch (error) {
            return { isWhatsApp: false };
        }
    }
    /**
     * Log notification to database
     */
    async logNotification(customerId, phone, message, success, messageId, error = null) {
        try {
            // Ensure table exists
            await this.ensureNotificationTable();
            await pool_1.databasePool.execute(`INSERT INTO whatsapp_notifications 
				(customer_id, phone, message, success, message_id, error, created_at) 
				VALUES (?, ?, ?, ?, ?, ?, NOW())`, [customerId, phone, message, success ? 1 : 0, messageId, error]);
        }
        catch (error) {
            console.error('Failed to log notification:', error);
        }
    }
    /**
     * Ensure notification table exists
     */
    async ensureNotificationTable() {
        await pool_1.databasePool.execute(`
			CREATE TABLE IF NOT EXISTS whatsapp_notifications (
				id INT AUTO_INCREMENT PRIMARY KEY,
				customer_id INT NULL,
				phone VARCHAR(50) NOT NULL,
				message TEXT NOT NULL,
				success BOOLEAN NOT NULL DEFAULT 0,
				message_id VARCHAR(255) NULL,
				error TEXT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				INDEX idx_customer_id (customer_id),
				INDEX idx_phone (phone),
				INDEX idx_created_at (created_at),
				INDEX idx_success (success)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
		`);
    }
    /**
     * Get notification history
     */
    async getHistory(limit = 50, offset = 0) {
        try {
            // Ensure table exists first
            await this.ensureNotificationTable();
            const [rows] = await pool_1.databasePool.execute(`SELECT 
					wn.*,
					c.name as customer_name,
					c.customer_code
				FROM whatsapp_notifications wn
				LEFT JOIN customers c ON wn.customer_id = c.id
				ORDER BY wn.created_at DESC
				LIMIT ? OFFSET ?`, [limit, offset]);
            if (rows && Array.isArray(rows)) {
                return rows;
            }
            return [];
        }
        catch (error) {
            console.error('Failed to get history:', error);
            // Return empty array on error
            return [];
        }
    }
}
// Singleton instance
let whatsappServiceInstance = null;
function getWhatsAppBusinessService() {
    if (!whatsappServiceInstance) {
        whatsappServiceInstance = new WhatsAppBusinessService();
    }
    return whatsappServiceInstance;
}
exports.default = WhatsAppBusinessService;
//# sourceMappingURL=WhatsAppBusinessService.js.map