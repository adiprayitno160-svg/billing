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
        this.MAX_RECONNECT_ATTEMPTS = 50;
        this.reconnectTimeout = null;
        this.qrRetryCount = 0;
        this.MAX_QR_RETRIES = 300; // Increased to give user 10 minutes to scan
        // Initialization promise for concurrency handling
        this.initPromise = null;
        this.readyResolvers = [];
        this.readyRejecters = [];
        // Message Queue
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.QUEUE_PROCESS_INTERVAL_MIN = 500; // Reduced from 5s to 0.5s
        this.QUEUE_PROCESS_INTERVAL_MAX = 2000; // Reduced from 10s to 2s
        this.MAX_QUEUE_SIZE = 500;
        // ========== ANTI-SPAM RATE LIMITING ==========
        // Per-contact rate limiting
        this.contactLastSent = new Map(); // phone -> last sent timestamp
        this.CONTACT_COOLDOWN_MS = 2000; // Reduced from 60s to 2s for better chatbot UX
        // Hourly/Daily rate limiting
        this.hourlySentCount = 0;
        this.dailySentCount = 0;
        this.lastHourlyReset = Date.now();
        this.lastDailyReset = Date.now();
        this.MAX_MESSAGES_PER_HOUR = 500; // Increased from 30 to 500
        this.MAX_MESSAGES_PER_DAY = 5000; // Increased from 200 to 5000
        // Progressive delay (gets slower as we send more)
        this.consecutiveSentCount = 0;
        this.lastBurstReset = Date.now();
        this.BURST_WINDOW_MS = 300000; // 5 minute window for burst detection
        this.BURST_THRESHOLD = 10; // After 10 messages in 5 min, increase delays
        // Duplicate detection
        this.recentMessages = new Map(); // hash -> timestamp
        this.DEDUP_WINDOW_MS = 5000; // 5 seconds dedup window
        // Paths
        this.AUTH_DIR = process.env.WA_SESSION_PATH
            ? (path_1.default.isAbsolute(process.env.WA_SESSION_PATH) ? process.env.WA_SESSION_PATH : path_1.default.join(process.cwd(), process.env.WA_SESSION_PATH))
            : path_1.default.join(process.cwd(), 'whatsapp_auth_v3');
        this.LOG_DIR = path_1.default.join(process.cwd(), 'logs', 'whatsapp');
        // Watchdog
        this.watchdogInterval = null;
        this.lastInitializationTime = 0;
        this.ensureDirectories();
        this.log('info', '🚀 WhatsApp Service instantiated');
        this.startWatchdog();
    }
    /**
     * Watchdog to monitor service health and auto-restart if stuck
     */
    startWatchdog() {
        if (this.watchdogInterval)
            clearInterval(this.watchdogInterval);
        this.watchdogInterval = setInterval(async () => {
            const instanceId = process.env.NODE_APP_INSTANCE || '0';
            if (instanceId !== '0')
                return;
            // Logic: If not connected, not in QR mode, and not already connecting
            // OR if stuck in 'isConnecting' for more than 5 minutes
            const now = Date.now();
            const isStuckInitializing = this.isConnecting && (now - this.lastInitializationTime > 300000); // 5 mins
            // Don't restart while QR code is being displayed (user might be scanning)
            if (this.qrCode) {
                return; // QR is active, don't interfere
            }
            if ((!this.isConnected && !this.isConnecting) || isStuckInitializing) {
                this.log('warn', `🐕 Watchdog: Service seems stuck or disconnected (Stuck: ${isStuckInitializing}). Triggering auto-restart...`);
                try {
                    await this.restart();
                }
                catch (e) {
                    this.log('error', 'Watchdog restart failed:', e.message);
                }
            }
        }, 60000); // Check every minute
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
                // Intentionally un-awaited for non-blocking IO
                fs_1.default.promises.appendFile(errorLogFile, errorMessage).catch(() => { });
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
            // Note: intentionally un-awaited so it runs in background without blocking
            fs_1.default.promises.appendFile(logFile, `${logMessage} ${data ? JSON.stringify(data) : ''}\n`).catch(() => { });
        }
        catch (e) {
            // Ignore file write errors
        }
    }
    /**
     * Initialize WhatsApp connection
     */
    async initialize() {
        console.trace('[WhatsApp] Initialize called (TRACE):');
        if (process.env.DISABLE_WHATSAPP === 'true') {
            this.log('info', '🚫 WhatsApp service is disabled via DISABLE_WHATSAPP env var.');
            return;
        }
        // PM2 Cluster Mode Check: Only initialize on the first instance
        // This prevents "Session Conflict (440)" errors when multiple instances try to connect
        const instanceId = process.env.NODE_APP_INSTANCE || '0';
        if (instanceId !== '0') {
            this.log('info', `⏭️ WhatsApp service skipping initialization on non-zero instance (${instanceId})`);
            return;
        }
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
                this.log('info', `🔄 Initializing WhatsApp connection... Path: ${this.AUTH_DIR}`);
                this.lastInitializationTime = Date.now();
                // Load auth state
                const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(this.AUTH_DIR);
                this.authState = { state, saveCreds };
                // Check if we already have creds
                if (state.creds && state.creds.registered) {
                    this.log('info', '📂 Found existing credentials in auth directory');
                }
                else {
                    this.log('info', '🆕 No existing credentials found, starting fresh session');
                }
                // Get latest version
                const { version, isLatest } = await (0, baileys_1.fetchLatestBaileysVersion)();
                this.log('info', `📦 Baileys Version: ${version.join('.')} (Latest: ${isLatest})`);
                // Create socket
                const logger = (0, pino_1.default)({ level: 'silent' });
                this.sock = (0, baileys_1.default)({
                    version,
                    logger: logger,
                    printQRInTerminal: false,
                    auth: {
                        creds: state.creds,
                        keys: (0, baileys_1.makeCacheableSignalKeyStore)(state.keys, logger),
                    },
                    browser: ['Chrome (Windows)', 'Chrome', '114.0.5735.199'],
                    generateHighQualityLinkPreview: true,
                    defaultQueryTimeoutMs: 120000,
                    connectTimeoutMs: 120000,
                    syncFullHistory: false,
                    transactionOpts: { maxCommitRetries: 5, delayBetweenTriesMs: 500 },
                });
                // Setup event handlers
                this.setupEventHandlers();
                this.log('info', '✅ Socket created, waiting for connection updates...');
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
        if (!this.sock && !this.isConnecting && process.env.DISABLE_WHATSAPP !== 'true') {
            this.initialize().catch(() => { });
        }
        if (process.env.DISABLE_WHATSAPP === 'true') {
            throw new Error('WhatsApp service is disabled.');
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
            // Detailed debug logging for connection state
            if (connection || qr || lastDisconnect) {
                this.log('debug', '🔄 Connection Update:', {
                    connection,
                    hasQr: !!qr,
                    errorCode: lastDisconnect?.error?.output?.statusCode
                });
            }
            // QR Code received
            if (qr) {
                this.qrRetryCount++;
                this.log('info', `📱 QR Code received (attempt ${this.qrRetryCount}/${this.MAX_QR_RETRIES})`);
                // Check if QR has been regenerated too many times (expired too many times)
                if (this.qrRetryCount > this.MAX_QR_RETRIES) {
                    this.log('warn', '⚠️ QR code expired too many times. Clearing session and restarting...');
                    this.qrRetryCount = 0;
                    this.qrCode = null;
                    this.qrDataUrl = null;
                    await this.clearSession();
                    this.initPromise = null;
                    setTimeout(() => this.initialize(), 3000);
                    return;
                }
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
                this.saveStatusToDisk();
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
                this.initPromise = null; // CRITICAL: Allow re-initialization
                this.emit('disconnected', statusCode);
                this.saveStatusToDisk();
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
                this.qrRetryCount = 0; // Reset QR retry counter
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
                this.saveStatusToDisk();
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
            this.log('error', '❌ Max reconnection attempts reached. Will auto-retry in 5 minutes...');
            this.emit('max-reconnect-reached');
            // Auto-reset after 5 minutes and try again
            setTimeout(() => {
                this.log('info', '🔄 Auto-resetting reconnect counter and retrying...');
                this.reconnectAttempts = 0;
                this.initPromise = null;
                this.initialize().catch(e => this.log('error', 'Auto-reconnect failed:', e.message));
            }, 5 * 60 * 1000);
            return;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectAttempts * 2000, 30000); // Max 30 seconds
        this.log('info', `🔄 Reconnecting in ${delay / 1000}s... (Attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
        this.reconnectTimeout = setTimeout(() => {
            this.initPromise = null;
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
     * Reset rate limiting counters if time window has passed
     */
    resetRateLimitCounters() {
        const now = Date.now();
        // Reset hourly counter
        if (now - this.lastHourlyReset >= 3600000) {
            this.hourlySentCount = 0;
            this.lastHourlyReset = now;
            this.log('debug', '🔄 Hourly rate limit counter reset');
        }
        // Reset daily counter
        if (now - this.lastDailyReset >= 86400000) {
            this.dailySentCount = 0;
            this.lastDailyReset = now;
            this.log('debug', '🔄 Daily rate limit counter reset');
        }
        // Reset burst counter
        if (now - this.lastBurstReset >= this.BURST_WINDOW_MS) {
            this.consecutiveSentCount = 0;
            this.lastBurstReset = now;
        }
        // Clean old contact cooldowns (remove entries older than 10 minutes)
        for (const [contact, timestamp] of this.contactLastSent.entries()) {
            if (now - timestamp > 600000) {
                this.contactLastSent.delete(contact);
            }
        }
        // Clean old dedup entries
        for (const [hash, timestamp] of this.recentMessages.entries()) {
            if (now - timestamp > this.DEDUP_WINDOW_MS) {
                this.recentMessages.delete(hash);
            }
        }
    }
    /**
     * Generate a hash for message deduplication
     */
    getMessageHash(to, content) {
        const textContent = content?.text || content?.caption || '';
        return `${to}:${textContent.substring(0, 100)}`;
    }
    /**
     * Calculate the appropriate delay based on rate limiting state
     */
    calculateSmartDelay() {
        this.resetRateLimitCounters();
        let baseDelay = this.QUEUE_PROCESS_INTERVAL_MIN;
        // Progressive delay: increase delay as we send more messages
        if (this.consecutiveSentCount >= this.BURST_THRESHOLD) {
            const extraDelay = (this.consecutiveSentCount - this.BURST_THRESHOLD) * 2000;
            baseDelay += Math.min(extraDelay, 30000); // Cap at 30 extra seconds
            this.log('debug', `🐢 Burst mode: Adding ${extraDelay}ms extra delay (${this.consecutiveSentCount} messages in window)`);
        }
        // If approaching hourly limit, slow down significantly
        if (this.hourlySentCount >= this.MAX_MESSAGES_PER_HOUR * 0.8) {
            baseDelay = Math.max(baseDelay, 30000); // At least 30 seconds
            this.log('warn', `⚠️ Approaching hourly limit (${this.hourlySentCount}/${this.MAX_MESSAGES_PER_HOUR}), slowing down`);
        }
        // Add randomness to look more human (±30%)
        const jitter = baseDelay * 0.3;
        const randomDelay = baseDelay + Math.floor(Math.random() * jitter * 2 - jitter);
        return Math.max(randomDelay, this.QUEUE_PROCESS_INTERVAL_MIN);
    }
    /**
     * Queue a message for sending with anti-spam protection
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
            // ===== ANTI-SPAM CHECKS =====
            this.resetRateLimitCounters();
            // Check hourly limit
            if (this.hourlySentCount >= this.MAX_MESSAGES_PER_HOUR) {
                this.log('warn', `🚫 Hourly rate limit reached (${this.hourlySentCount}/${this.MAX_MESSAGES_PER_HOUR}). Message to ${to} rejected.`);
                resolve({ success: false, error: `Rate limit: Batas pengiriman per jam tercapai (${this.MAX_MESSAGES_PER_HOUR} pesan/jam). Coba lagi nanti.` });
                return;
            }
            // Check daily limit
            if (this.dailySentCount >= this.MAX_MESSAGES_PER_DAY) {
                this.log('warn', `🚫 Daily rate limit reached (${this.dailySentCount}/${this.MAX_MESSAGES_PER_DAY}). Message to ${to} rejected.`);
                resolve({ success: false, error: `Rate limit: Batas pengiriman per hari tercapai (${this.MAX_MESSAGES_PER_DAY} pesan/hari). Coba lagi besok.` });
                return;
            }
            // Check duplicate message in recent sent history
            const msgHash = this.getMessageHash(this.formatPhoneNumber(to), content);
            const lastSentTime = this.recentMessages.get(msgHash);
            if (lastSentTime && Date.now() - lastSentTime < this.DEDUP_WINDOW_MS) {
                this.log('warn', `🚫 Duplicate message detected to ${to} (sent ${Math.round((Date.now() - lastSentTime) / 1000)}s ago). Skipping.`);
                resolve({ success: true, error: 'Pesan duplikat terdeteksi, dilewati.' });
                return;
            }
            // Check duplicate message ALREADY IN QUEUE (This prevents piling up duplicates if WA reconnects)
            const existingInQueue = this.messageQueue.find(item => this.getMessageHash(item.to, item.content) === msgHash);
            if (existingInQueue) {
                this.log('warn', `🚫 Identical message already in queue for ${to}. Skipping duplicate enqueue.`);
                // Just resolve immediately, it will be handled by the existing queue item
                resolve({ success: true, error: 'Pesan sudah ada di dalam antrean saat ini, dilewati.' });
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
            this.log('debug', `📤 Message queued: ${queueItem.id} to ${to} (Queue: ${this.messageQueue.length}, Hourly: ${this.hourlySentCount}/${this.MAX_MESSAGES_PER_HOUR}, Daily: ${this.dailySentCount}/${this.MAX_MESSAGES_PER_DAY})`);
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
                if (!this.sock || !this.isConnected) {
                    this.messageQueue.unshift(item); // Put back
                    break;
                }
                this.log('info', `📨 Processing message ${processed}/${processed + this.messageQueue.length} (${item.id}) to ${item.to}`);
                // Only check registration if it's the first attempt and NOT a group/LID
                if (item.retries === 0 && !item.to.includes('@g.us') && !item.to.includes('@lid')) {
                    // Check if number is valid - some numbers might be slow to check
                    try {
                        const exists = await Promise.race([
                            this.isRegistered(item.to),
                            new Promise(resolve => setTimeout(() => resolve(true), 2000))
                        ]);
                        if (!exists) {
                            this.log('warn', `⚠️ Number ${item.to} is NOT registered on WhatsApp. Skipping.`);
                            item.resolve({ success: false, error: 'Nomor tidak terdaftar di WhatsApp' });
                            continue;
                        }
                    }
                    catch (e) {
                        this.log('debug', `Registration check error for ${item.to}, proceeding anyway`);
                    }
                }
                // Add a safety timeout for the actual sending
                const result = await Promise.race([
                    this.sendMessageDirect(item.to, item.content, item.options),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Kirim pesan timeout (30 detik)')), 30000))
                ]);
                if (result.success) {
                    this.log('info', `✅ Message sent successfully to ${item.to} (ID: ${result.messageId})`);
                    item.resolve(result);
                }
                else {
                    throw new Error(result.error || 'Failed to send');
                }
            }
            catch (error) {
                const errorMessage = error.message || 'Unknown error';
                // If connection error, put back and wait
                if (errorMessage.includes('not connected') || errorMessage.includes('socket') || !this.isConnected) {
                    this.log('warn', `🔌 Connection error during send, re-queueing ${item.id}`);
                    this.messageQueue.unshift(item); // Put back at front
                    break; // Stop processing for now
                }
                item.retries++;
                this.log('warn', `⚠️ Message ${item.id} to ${item.to} failed. Attempt ${item.retries}/${item.maxRetries}. Error: ${errorMessage}`);
                if (item.retries < item.maxRetries) {
                    this.messageQueue.push(item);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                else {
                    item.resolve({ success: false, error: `Gagal mengirim: ${errorMessage}` });
                    this.log('error', `❌ Message ${item.id} permanently failed: ${errorMessage}`);
                }
            }
            // ===== ANTI-SPAM: Record successful send =====
            if (!('error' in item) || item.retries === 0) {
                this.hourlySentCount++;
                this.dailySentCount++;
                this.consecutiveSentCount++;
                this.contactLastSent.set(item.to, Date.now());
                // Record for dedup
                const msgHash = this.getMessageHash(item.to, item.content);
                this.recentMessages.set(msgHash, Date.now());
            }
            // Smart adaptive delay before next message
            if (this.messageQueue.length > 0) {
                // Check contact cooldown for next message
                const nextItem = this.messageQueue[0];
                if (nextItem) {
                    const nextContactLastSent = this.contactLastSent.get(nextItem.to);
                    if (nextContactLastSent) {
                        const contactWait = this.CONTACT_COOLDOWN_MS - (Date.now() - nextContactLastSent);
                        if (contactWait > 0) {
                            this.log('debug', `⏳ Contact cooldown: Waiting ${Math.round(contactWait / 1000)}s for ${nextItem.to}`);
                            await new Promise(resolve => setTimeout(resolve, contactWait));
                        }
                    }
                }
                const smartDelay = this.calculateSmartDelay();
                this.log('debug', `⏳ Smart delay: ${smartDelay}ms (Burst: ${this.consecutiveSentCount}, Hourly: ${this.hourlySentCount}/${this.MAX_MESSAGES_PER_HOUR})`);
                await new Promise(resolve => setTimeout(resolve, smartDelay));
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
     * Get service status (Cluster aware)
     */
    getStatus() {
        const instanceId = process.env.NODE_APP_INSTANCE || '0';
        // If we are instance 0 (or not in cluster), return our real status
        if (instanceId === '0') {
            const status = {
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
            // Save for other instances to read
            this.saveStatusToDisk(status);
            return status;
        }
        // If we are NOT instance 0, read from disk to avoid flickering
        return this.readStatusFromDisk();
    }
    /**
     * Save current status to disk for cluster sharing
     */
    saveStatusToDisk(status) {
        try {
            if (!fs_1.default.existsSync(this.LOG_DIR)) {
                fs_1.default.mkdirSync(this.LOG_DIR, { recursive: true });
            }
            const currentStatus = status || {
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
            const filePath = path_1.default.join(this.LOG_DIR, 'cluster_status.json');
            fs_1.default.writeFileSync(filePath, JSON.stringify({
                ...currentStatus,
                _instance: process.env.NODE_APP_INSTANCE || '0',
                _updatedAt: new Date().toISOString()
            }, null, 2));
        }
        catch (e) {
            // Quietly fail for status saving
        }
    }
    /**
     * Read status from disk (used by non-zero cluster instances)
     */
    readStatusFromDisk() {
        try {
            const filePath = path_1.default.join(this.LOG_DIR, 'cluster_status.json');
            if (fs_1.default.existsSync(filePath)) {
                const data = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
                // Check if data is not too old (e.g., > 30 minutes)
                // PM2 cluster worker instances rely on this file. 
                // We set a long timeout because Instance 0 only writes to it on events or when polled directly.
                const updatedAt = new Date(data._updatedAt);
                if (Date.now() - updatedAt.getTime() < 1800000) {
                    return data;
                }
            }
        }
        catch (e) {
            // ignore
        }
        // Default fallback if no valid disk status found
        return {
            ready: false,
            initializing: false,
            qr: null,
            qrDataUrl: null,
            phoneNumber: null,
            name: null,
            lastConnected: null,
            reconnectAttempts: 0,
            messagesSent: 0,
            messagesReceived: 0
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
        this.qrRetryCount = 0;
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
        this.qrRetryCount = 0;
        this.initPromise = null;
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
                this.log('info', `🗑️ Clearing session directory: ${this.AUTH_DIR}`);
                // Robust deletion for Windows (handles file locking better)
                try {
                    fs_1.default.rmSync(this.AUTH_DIR, { recursive: true, force: true });
                }
                catch (rmError) {
                    this.log('warn', `⚠️ Standard deletion failed: ${rmError.message}. Using fallback...`);
                    try {
                        const trashDir = `${this.AUTH_DIR}_trash_${Date.now()}`;
                        fs_1.default.renameSync(this.AUTH_DIR, trashDir);
                        // Non-blocking attempt to delete the renamed folder later
                        setTimeout(() => {
                            try {
                                fs_1.default.rmSync(trashDir, { recursive: true, force: true });
                            }
                            catch (e) { }
                        }, 10000);
                    }
                    catch (renameError) {
                        this.log('error', '❌ Completely failed to clear session directory.');
                    }
                }
                // Ensure directory exists even if deletion was partial
                if (!fs_1.default.existsSync(this.AUTH_DIR)) {
                    fs_1.default.mkdirSync(this.AUTH_DIR, { recursive: true });
                }
            }
            this.log('info', '✅ Session cleanup request completed');
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
exports.default = exports.whatsappService;
//# sourceMappingURL=WhatsAppService.js.map