"use strict";
/**
 * WhatsApp Service - Modern Baileys Implementation
 * Super Dynamic, Robust & Feature-Rich
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - QR Code management for web display
 * - Message queue with retry mechanism
 * - Typing indicators & read receipts
 * - Image, document, and media support
 * - Group messaging support
 * - Status/presence management
 * - Event-driven architecture
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
exports.whatsappService = exports.WhatsAppService = void 0;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const pino_1 = __importDefault(require("pino"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const qrcode_1 = __importDefault(require("qrcode"));
const events_1 = __importDefault(require("events"));
class WhatsAppService extends events_1.default {
    constructor() {
        super();
        this.sock = null;
        this.authState = null;
        // Status tracking
        this.qrCode = null;
        this.qrDataUrl = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.phoneNumber = null;
        this.displayName = null;
        this.lastConnected = null;
        // Statistics
        this.messagesSent = 0;
        this.messagesReceived = 0;
        // Reconnection
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 10;
        this.reconnectTimeout = null;
        // Initialization promise for concurrency handling
        this.initPromise = null;
        this.readyResolvers = [];
        this.readyRejecters = [];
        // Message Queue
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.QUEUE_PROCESS_INTERVAL_MIN = 3000; // 3 seconds min
        this.QUEUE_PROCESS_INTERVAL_MAX = 6000; // 6 seconds max
        this.MAX_QUEUE_SIZE = 500;
        // Paths
        this.AUTH_DIR = path_1.default.join(process.cwd(), 'whatsapp_auth_v2');
        this.LOG_DIR = path_1.default.join(process.cwd(), 'logs', 'whatsapp');
        this.ensureDirectories();
        this.log('info', '🚀 WhatsApp Service instantiated');
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!WhatsAppService.instance) {
            WhatsAppService.instance = new WhatsAppService();
        }
        return WhatsAppService.instance;
    }
    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        [this.AUTH_DIR, this.LOG_DIR].forEach(dir => {
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
        });
    }
    /**
     * Custom logger
     */
    log(level, message, data) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [WhatsApp] [${level.toUpperCase()}] ${message}`;
        if (level === 'error') {
            console.error(logMessage, data || '');
            // Write to dedicated error log
            try {
                const errorLogFile = path_1.default.join(this.LOG_DIR, 'whatsapp_error.log');
                const errorMessage = `${logMessage} ${data ? JSON.stringify(data, Object.getOwnPropertyNames(data)) : ''}\n`;
                fs_1.default.appendFileSync(errorLogFile, errorMessage);
            }
            catch (e) {
                // Ignore specific error log write failure
            }
        }
        else if (level === 'warn') {
            console.warn(logMessage, data || '');
        }
        else {
            console.log(logMessage, data || '');
        }
        // Write to daily log
        try {
            const logFile = path_1.default.join(this.LOG_DIR, `whatsapp_${new Date().toISOString().split('T')[0]}.log`);
            fs_1.default.appendFileSync(logFile, `${logMessage} ${data ? JSON.stringify(data) : ''}\n`);
        }
        catch (e) {
            // Ignore file write errors
        }
    }
    /**
     * Initialize WhatsApp connection
     */
    async initialize() {
        if (this.initPromise) {
            return this.initPromise;
        }
        if (this.isConnected) {
            return;
        }
        this.initPromise = (async () => {
            this.isConnecting = true;
            this.emit('initializing');
            try {
                this.log('info', '🔄 Initializing WhatsApp connection...');
                // Load auth state
                const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(this.AUTH_DIR);
                this.authState = { state, saveCreds };
                // Get latest version
                const { version, isLatest } = await (0, baileys_1.fetchLatestBaileysVersion)();
                this.log('info', `📦 Baileys Version: ${version.join('.')} (Latest: ${isLatest})`);
                // Create socket
                const logger = (0, pino_1.default)({ level: 'silent' });
                this.sock = (0, baileys_1.default)({
                    version,
                    logger: logger,
                    printQRInTerminal: true,
                    auth: {
                        creds: state.creds,
                        keys: (0, baileys_1.makeCacheableSignalKeyStore)(state.keys, logger),
                    },
                    browser: ['ISP Billing System', 'Chrome', '120.0.0'],
                    generateHighQualityLinkPreview: true,
                    defaultQueryTimeoutMs: 60000,
                    connectTimeoutMs: 60000,
                    keepAliveIntervalMs: 30000,
                    retryRequestDelayMs: 500,
                    qrTimeout: 60000,
                    markOnlineOnConnect: true,
                });
                // Setup event handlers
                this.setupEventHandlers();
                this.log('info', '✅ Socket created, waiting for connection...');
            }
            catch (error) {
                this.log('error', '❌ Failed to initialize:', error.message);
                this.isConnecting = false;
                this.initPromise = null;
                this.emit('error', error);
                this.scheduleReconnect();
                throw error;
            }
        })();
        return this.initPromise;
    }
    /**
     * Wait for the connection to be ready
     * @param timeoutMs Maximum time to wait in milliseconds
     */
    async waitForReady(timeoutMs = 30000) {
        if (this.isConnected)
            return;
        // Trigger initialization if not already
        if (!this.sock && !this.isConnecting) {
            this.initialize().catch(() => { });
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const index = this.readyResolvers.indexOf(resolve);
                if (index !== -1) {
                    this.readyResolvers.splice(index, 1);
                    this.readyRejecters.splice(index, 1);
                    if (this.qrCode) {
                        reject(new Error('WhatsApp memerlukan scan QR code.'));
                    }
                    else {
                        reject(new Error('Timeout menunggu koneksi WhatsApp ready.'));
                    }
                }
            }, timeoutMs);
            this.readyResolvers.push(() => {
                clearTimeout(timeout);
                resolve();
            });
            this.readyRejecters.push((err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
    /**
     * Setup all event handlers
     */
    setupEventHandlers() {
        if (!this.sock)
            return;
        // Credentials update
        this.sock.ev.on('creds.update', async () => {
            await this.authState?.saveCreds();
        });
        // Connection update
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            // QR Code received
            if (qr) {
                this.log('info', '📱 QR Code received');
                this.qrCode = qr;
                // Generate Data URL for web display
                try {
                    this.qrDataUrl = await qrcode_1.default.toDataURL(qr, {
                        width: 256,
                        margin: 2,
                        color: { dark: '#000000', light: '#ffffff' }
                    });
                }
                catch (e) {
                    this.log('warn', 'Failed to generate QR data URL');
                }
                this.emit('qr', qr, this.qrDataUrl);
                // Reject any waiters because we definitely need a QR scan now
                const rejecters = [...this.readyRejecters];
                this.readyResolvers = [];
                this.readyRejecters = [];
                const qrError = new Error('WhatsApp memerlukan scan QR code. Silakan buka menu WhatsApp Bisnis.');
                rejecters.forEach(reject => reject(qrError));
            }
            // Connection closed
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                // Reconnect if not logged out AND not 440 (Conflict/Replaced)
                // If 440, we MUST clear session because keys are invalid
                const shouldReconnect = statusCode !== baileys_1.DisconnectReason.loggedOut && statusCode !== 440;
                this.log('warn', `❌ Connection closed. Status: ${statusCode}, Reconnect: ${shouldReconnect}`);
                this.isConnected = false;
                this.isConnecting = false;
                this.qrCode = null;
                this.qrDataUrl = null;
                this.isProcessingQueue = false; // Stop queue
                this.emit('disconnected', statusCode);
                if (statusCode === 440) {
                    this.log('error', '⚠️ Session conflict detected (440). Connection replaced. Clearing session and restarting...');
                    await this.clearSession();
                    // Allow some time for cleanup before restart
                    setTimeout(() => this.initialize(), 3000);
                }
                else if (statusCode === baileys_1.DisconnectReason.loggedOut) {
                    this.log('info', '🔒 Logged out, clearing session...');
                    await this.clearSession();
                }
                else if (shouldReconnect) {
                    this.scheduleReconnect();
                }
            }
            // Connection open
            if (connection === 'open') {
                this.log('info', '✅ WhatsApp Connected Successfully!');
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.lastConnected = new Date();
                this.qrCode = null;
                this.qrDataUrl = null;
                // Get user info
                if (this.sock?.user) {
                    this.phoneNumber = this.sock.user.id.split(':')[0];
                    this.displayName = this.sock.user.name || null;
                    this.log('info', `📞 Connected as: ${this.displayName} (${this.phoneNumber})`);
                }
                this.emit('connected', {
                    phoneNumber: this.phoneNumber,
                    name: this.displayName
                });
                // Resolve all waiters
                const resolvers = [...this.readyResolvers];
                this.readyResolvers = [];
                this.readyRejecters = [];
                resolvers.forEach(resolve => resolve());
                // Start processing message queue
                this.startQueueProcessor();
            }
        });
        // Message received
        this.sock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify' || m.type === 'append') {
                for (const msg of m.messages) {
                    // Ignore status updates and broadcasts
                    if (msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid?.includes('@broadcast')) {
                        continue;
                    }
                    if (!msg.key.fromMe && msg.message) {
                        this.messagesReceived++;
                        const sender = msg.key.remoteJid;
                        const messageText = this.extractMessageText(msg);
                        // Filter old messages
                        const msgTimestamp = typeof msg.messageTimestamp === 'number'
                            ? msg.messageTimestamp
                            : msg.messageTimestamp?.low || Math.floor(Date.now() / 1000);
                        if (Math.floor(Date.now() / 1000) - msgTimestamp > 300) {
                            continue;
                        }
                        // Only log meaningful messages
                        if (messageText) {
                            this.log('info', `📩 Message from ${sender}: ${messageText.substring(0, 50)}...`);
                        }
                        this.emit('message', {
                            from: sender,
                            text: messageText,
                            message: msg,
                            timestamp: new Date(msgTimestamp * 1000)
                        });
                        // Handle incoming message
                        try {
                            const { WhatsAppHandler } = await Promise.resolve().then(() => __importStar(require('./WhatsAppHandler')));
                            await WhatsAppHandler.handleIncomingMessage(msg, this);
                        }
                        catch (e) {
                            this.log('error', 'Error handling message:', e.message);
                        }
                    }
                }
            }
        });
        // Presence update
        this.sock.ev.on('presence.update', (presence) => {
            this.emit('presence', presence);
        });
        // Message status update
        this.sock.ev.on('messages.update', (updates) => {
            for (const update of updates) {
                this.emit('message-status', update);
            }
        });
    }
    /**
     * Extract text from message (Handles Ephemeral, ViewOnce, etc)
     */
    extractMessageText(msg) {
        if (!msg.message)
            return null;
        // Unwrap ephemeral/viewOnce messages which Baileys might nest
        const content = (0, baileys_1.getContentType)(msg.message);
        let m = msg.message;
        if (content === 'ephemeralMessage') {
            m = msg.message.ephemeralMessage?.message || m;
        }
        else if (content === 'viewOnceMessage') {
            m = msg.message.viewOnceMessage?.message || m;
        }
        else if (content === 'documentWithCaptionMessage') {
            m = msg.message.documentWithCaptionMessage?.message || m;
        }
        if (!m)
            return null;
        return (m.conversation ||
            m.extendedTextMessage?.text ||
            m.imageMessage?.caption ||
            m.videoMessage?.caption ||
            m.documentMessage?.caption ||
            null);
    }
    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            this.log('error', '❌ Max reconnection attempts reached. Manual restart required.');
            this.emit('max-reconnect-reached');
            return;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectAttempts * 2000, 30000); // Max 30 seconds
        this.log('info', `🔄 Reconnecting in ${delay / 1000}s... (Attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
        this.reconnectTimeout = setTimeout(() => {
            this.initialize();
        }, delay);
    }
    formatPhoneNumber(phone) {
        if (!phone)
            return '';
        // If it's already a full JID, return as is
        if (phone.includes('@s.whatsapp.net'))
            return phone;
        if (phone.includes('@g.us'))
            return phone;
        if (phone.includes('@lid'))
            return phone;
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');
        // Handle Indonesian numbers
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }
        // If it doesn't start with 62 but is long enough to be a number (e.g. 8123...), prepend 62
        // Only prepend if it looks like a phone number (e.g. starts with 8)
        else if (!cleaned.startsWith('62') && (cleaned.startsWith('8') || cleaned.length >= 9)) {
            cleaned = '62' + cleaned;
        }
        return `${cleaned}@s.whatsapp.net`;
    }
    /**
     * Send a text message
     */
    async sendMessage(to, text, options) {
        return this.queueMessage(to, { text }, options);
    }
    /**
     * Send an image
     */
    async sendImage(to, imagePath, caption) {
        if (!fs_1.default.existsSync(imagePath)) {
            this.log('error', `Image file not found: ${imagePath}`);
            return { success: false, error: 'Image file not found' };
        }
        const imageBuffer = fs_1.default.readFileSync(imagePath);
        return this.queueMessage(to, {
            image: imageBuffer,
            caption: caption || undefined
        });
    }
    /**
     * Send a document
     */
    async sendDocument(to, filePath, fileName, caption) {
        if (!fs_1.default.existsSync(filePath)) {
            this.log('error', `Document file not found: ${filePath}`);
            return { success: false, error: 'File not found' };
        }
        const fileBuffer = fs_1.default.readFileSync(filePath);
        const mimeType = this.getMimeType(filePath);
        return this.queueMessage(to, {
            document: fileBuffer,
            mimetype: mimeType,
            fileName: fileName || path_1.default.basename(filePath),
            caption: caption || undefined
        });
    }
    /**
     * Get MIME type from file extension
     */
    getMimeType(filePath) {
        const ext = path_1.default.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
    /**
     * Queue a message for sending
     */
    queueMessage(to, content, options) {
        return new Promise((resolve, reject) => {
            // Basic validation
            if (!to || to.length < 5) {
                resolve({ success: false, error: 'Invalid phone number' });
                return;
            }
            if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
                this.log('warn', `Message queue full (${this.messageQueue.length}), rejects new message to ${to}`);
                resolve({ success: false, error: 'Antrian pesan penuh, silakan tunggu beberapa saat.' });
                return;
            }
            const queueItem = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                to: this.formatPhoneNumber(to),
                content,
                options,
                retries: 0,
                maxRetries: 3,
                createdAt: new Date(),
                resolve,
                reject
            };
            this.messageQueue.push(queueItem);
            this.log('debug', `📤 Message queued: ${queueItem.id} to ${to}`);
            // Start processing if not already
            if (!this.isProcessingQueue && this.isConnected) {
                this.startQueueProcessor();
            }
        });
    }
    /**
     * Start the message queue processor
     */
    startQueueProcessor() {
        if (this.isProcessingQueue) {
            // Queue is already running
            return;
        }
        this.log('debug', `🚀 Starting queue processor. Queue size: ${this.messageQueue.length}`);
        this.isProcessingQueue = true;
        this.processQueue();
    }
    /**
     * Process the message queue
     */
    async processQueue() {
        // Safety processed count
        let processed = 0;
        while (this.messageQueue.length > 0 && this.isConnected) {
            const item = this.messageQueue.shift();
            processed++;
            try {
                this.log('info', `📨 Processing message ${processed}/${processed + this.messageQueue.length} (${item.id}) to ${item.to}`);
                // Only check registration if it's the first attempt and NOT a group/LID
                if (item.retries === 0 && !item.to.includes('@g.us') && !item.to.includes('@lid')) {
                    // Optional: Skip if already known valid customers to speed up
                    // For now, keep it but add a fast timeout
                    const exists = await Promise.race([
                        this.isRegistered(item.to),
                        new Promise(resolve => setTimeout(() => resolve(true), 3000)) // 3s timeout
                    ]);
                    if (!exists) {
                        this.log('warn', `🚫 Number ${item.to} is NOT registered. Skipping.`);
                        item.resolve({ success: false, error: 'Nomor tidak terdaftar di WhatsApp' });
                        continue;
                    }
                }
                const result = await this.sendMessageDirect(item.to, item.content, item.options);
                if (result.success) {
                    this.log('info', `✅ Message sent successfully to ${item.to} (ID: ${result.messageId})`);
                    item.resolve(result);
                }
                else {
                    throw new Error(result.error || 'Failed to send');
                }
            }
            catch (error) {
                item.retries++;
                const errorMessage = error.message || error;
                this.log('warn', `⚠️ Message ${item.id} to ${item.to} failed. Attempt ${item.retries}/${item.maxRetries}. Error: ${errorMessage}`);
                if (item.retries < item.maxRetries) {
                    // Re-queue for retry (put in the end)
                    this.messageQueue.push(item);
                    // Wait longer before next attempt if it's a connection issue
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                else {
                    item.resolve({ success: false, error: `Gagal mengirim setelah ${item.maxRetries} kali: ${errorMessage}` });
                    this.log('error', `❌ Message ${item.id} permanently failed: ${errorMessage}`);
                }
            }
            // Human-like random delay before next message (2-5 seconds)
            // Only wait if there are more messages left in the queue
            if (this.messageQueue.length > 0) {
                const randomDelay = Math.floor(Math.random() * (this.QUEUE_PROCESS_INTERVAL_MAX - this.QUEUE_PROCESS_INTERVAL_MIN + 1)) + this.QUEUE_PROCESS_INTERVAL_MIN;
                this.log('debug', `⏳ Waiting ${randomDelay}ms before next message...`);
                await new Promise(resolve => setTimeout(resolve, randomDelay));
            }
            // Yield event loop
            if (processed % 5 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
        this.isProcessingQueue = false;
        this.log('debug', `🏁 Queue processor stopped. Remaining: ${this.messageQueue.length}`);
    }
    /**
     * Send message directly (internal)
     */
    async sendMessageDirect(to, content, options) {
        if (!this.sock || !this.isConnected) {
            throw new Error('WhatsApp not connected');
        }
        try {
            // Ensure JID is correct
            const jid = this.formatPhoneNumber(to);
            // Show typing indicator
            if (options?.typing !== false) {
                await this.sock.sendPresenceUpdate('composing', jid);
                await new Promise(resolve => setTimeout(resolve, options?.typingDuration || 500));
            }
            // Send message
            const sent = await this.sock.sendMessage(jid, content, {
                quoted: options?.quoted
            });
            // Clear typing
            await this.sock.sendPresenceUpdate('paused', jid);
            this.messagesSent++;
            return {
                success: true,
                messageId: sent?.key?.id || undefined,
                timestamp: Date.now()
            };
        }
        catch (error) {
            this.log('error', `Failed to send message to ${to}:`, error.message);
            throw error;
        }
    }
    /**
     * Check if a number is registered on WhatsApp
     */
    async isRegistered(phone) {
        if (!this.sock || !this.isConnected)
            return false;
        // Skip check for group and LID
        if (phone.includes('@g.us') || phone.includes('@lid'))
            return true;
        try {
            // Clean phone number (digits only)
            const cleaned = phone.replace(/\D/g, '');
            const [result] = await this.sock.onWhatsApp(cleaned);
            this.log('debug', `🔍 Registration check for ${cleaned}: ${result?.exists || false}`);
            return result?.exists || false;
        }
        catch (e) {
            this.log('warn', `⚠️ Registration check failed for ${phone}: ${e.message}`);
            // Fallback to true to try sending anyway if check fails
            return true;
        }
    }
    /**
     * Get service status
     */
    getStatus() {
        return {
            ready: this.isConnected,
            initializing: this.isConnecting,
            qr: this.qrCode,
            qrDataUrl: this.qrDataUrl,
            phoneNumber: this.phoneNumber,
            name: this.displayName,
            lastConnected: this.lastConnected,
            reconnectAttempts: this.reconnectAttempts,
            messagesSent: this.messagesSent,
            messagesReceived: this.messagesReceived
        };
    }
    /**
     * Restart the service
     */
    async restart() {
        this.log('info', '🔄 Restarting WhatsApp service...');
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.sock) {
            try {
                this.sock.end(undefined);
            }
            catch (e) { }
            this.sock = null;
        }
        // Reset internal state
        this.isConnected = false;
        this.isConnecting = false;
        this.qrCode = null;
        this.qrDataUrl = null;
        this.reconnectAttempts = 0;
        this.initPromise = null; // IMPORTANT: Allow re-initialization
        this.log('info', '♻️ WhatsApp service state reset, starting initialization...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.initialize();
    }
    /**
     * Logout and clear session
     */
    async logout() {
        this.log('info', '🔒 Logging out...');
        try {
            if (this.sock) {
                await this.sock.logout();
                this.sock.end(undefined);
                this.sock = null;
            }
        }
        catch (e) {
            this.log('warn', 'Error during logout:', e.message);
        }
        await this.clearSession();
        this.isConnected = false;
        this.isConnecting = false;
        this.phoneNumber = null;
        this.displayName = null;
        this.qrCode = null;
        this.qrDataUrl = null;
        this.emit('logout');
        // Restart to generate new QR
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.initialize();
    }
    /**
     * Clear session data
     */
    async clearSession() {
        try {
            if (fs_1.default.existsSync(this.AUTH_DIR)) {
                fs_1.default.rmSync(this.AUTH_DIR, { recursive: true, force: true });
                fs_1.default.mkdirSync(this.AUTH_DIR, { recursive: true });
            }
            this.log('info', '✅ Session cleared');
        }
        catch (e) {
            this.log('error', 'Failed to clear session:', e.message);
        }
    }
    /**
     * Get raw socket (for advanced usage)
     */
    getSocket() {
        return this.sock;
    }
}
exports.WhatsAppService = WhatsAppService;
// Export singleton instance
exports.whatsappService = WhatsAppService.getInstance();
// Auto-initialize on module load
if (process.env.DISABLE_WHATSAPP !== 'true') {
    exports.whatsappService.initialize().catch(err => {
        console.error('[WhatsApp] Failed to auto-initialize:', err.message);
    });
}
else {
    console.log('[WhatsApp] Auto-initialization disabled (DISABLE_WHATSAPP=true)');
}
