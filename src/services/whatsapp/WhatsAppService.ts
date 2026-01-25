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

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  proto,
  AnyMessageContent,
  delay,
  getContentType,
  downloadMediaMessage,
  isJidGroup,
  jidNormalizedUser
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import EventEmitter from 'events';

// Types
export interface WhatsAppStatus {
  ready: boolean;
  initializing: boolean;
  qr: string | null;
  qrDataUrl: string | null;
  phoneNumber: string | null;
  name: string | null;
  lastConnected: Date | null;
  reconnectAttempts: number;
  messagesSent: number;
  messagesReceived: number;
}

export interface SendMessageOptions {
  typing?: boolean;
  typingDuration?: number;
  quoted?: proto.IWebMessageInfo;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  timestamp?: number;
  error?: string;
}

// Message Queue Item
interface QueuedMessage {
  id: string;
  to: string;
  content: AnyMessageContent;
  options?: SendMessageOptions;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  resolve: (result: MessageResult) => void;
  reject: (error: Error) => void;
}

export class WhatsAppService extends EventEmitter {
  private static instance: WhatsAppService;
  private sock: WASocket | null = null;
  private authState: { state: any; saveCreds: () => Promise<void> } | null = null;

  // Status tracking
  public qrCode: string | null = null;
  public qrDataUrl: string | null = null;
  public isConnected: boolean = false;
  public isConnecting: boolean = false;
  public phoneNumber: string | null = null;
  public displayName: string | null = null;
  public lastConnected: Date | null = null;

  // Statistics
  private messagesSent: number = 0;
  private messagesReceived: number = 0;

  // Reconnection
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  // Message Queue
  private messageQueue: QueuedMessage[] = [];
  private isProcessingQueue: boolean = false;
  private readonly QUEUE_PROCESS_INTERVAL = 1000; // 1 second between messages
  private readonly MAX_QUEUE_SIZE = 100;

  // Paths
  private readonly AUTH_DIR = path.join(process.cwd(), 'whatsapp_auth');
  private readonly LOG_DIR = path.join(process.cwd(), 'logs', 'whatsapp');

  private constructor() {
    super();
    this.ensureDirectories();
    this.log('info', '🚀 WhatsApp Service instantiated');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    [this.AUTH_DIR, this.LOG_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Custom logger
   */
  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [WhatsApp] [${level.toUpperCase()}] ${message}`;

    if (level === 'error') {
      console.error(logMessage, data || '');
    } else if (level === 'warn') {
      console.warn(logMessage, data || '');
    } else {
      console.log(logMessage, data || '');
    }

    // Write to file
    try {
      const logFile = path.join(this.LOG_DIR, `whatsapp_${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFile, `${logMessage} ${data ? JSON.stringify(data) : ''}\n`);
    } catch (e) {
      // Ignore file write errors
    }
  }

  /**
   * Initialize WhatsApp connection
   */
  public async initialize(): Promise<void> {
    if (this.isConnecting) {
      this.log('warn', 'Already initializing, skipping...');
      return;
    }

    if (this.isConnected) {
      this.log('info', 'Already connected');
      return;
    }

    this.isConnecting = true;
    this.emit('initializing');

    try {
      this.log('info', '🔄 Initializing WhatsApp connection...');

      // Load auth state
      const { state, saveCreds } = await useMultiFileAuthState(this.AUTH_DIR);
      this.authState = { state, saveCreds };

      // Get latest version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      this.log('info', `📦 Baileys Version: ${version.join('.')} (Latest: ${isLatest})`);

      // Create socket
      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        logger: logger as any,
        printQRInTerminal: true,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger as any),
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

    } catch (error: any) {
      this.log('error', '❌ Failed to initialize:', error.message);
      this.isConnecting = false;
      this.emit('error', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Setup all event handlers
   */
  private setupEventHandlers(): void {
    if (!this.sock) return;

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
          this.qrDataUrl = await QRCode.toDataURL(qr, {
            width: 256,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
          });
        } catch (e) {
          this.log('warn', 'Failed to generate QR data URL');
        }

        this.emit('qr', qr, this.qrDataUrl);
      }

      // Connection closed
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        // Reconnect if not logged out AND not 440 (Conflict/Replaced)
        // If 440, we MUST clear session because keys are invalid
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 440;

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
        } else if (statusCode === DisconnectReason.loggedOut) {
          this.log('info', '🔒 Logged out, clearing session...');
          await this.clearSession();
        } else if (shouldReconnect) {
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

        // Start processing message queue
        this.startQueueProcessor();
      }
    });

    // Message received
    this.sock.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify' || m.type === 'append') {
        for (const msg of m.messages) {

          if (!msg.key.fromMe && msg.message) {
            this.messagesReceived++;
            const sender = msg.key.remoteJid;
            const messageText = this.extractMessageText(msg);

            // Filter old messages (prevent spam on reconnect)
            const msgTimestamp = typeof msg.messageTimestamp === 'number'
              ? msg.messageTimestamp
              : msg.messageTimestamp?.low || Math.floor(Date.now() / 1000);

            // If message is older than 5 minutes, ignore it
            if (Math.floor(Date.now() / 1000) - msgTimestamp > 300) {
              // this.log('debug', `Ignoring old message from ${sender} (Time: ${msgTimestamp})`);
              continue;
            }

            this.log('info', `📩 Message from ${sender}: ${messageText?.substring(0, 50)}...`);

            this.emit('message', {
              from: sender,
              text: messageText,
              message: msg,
              timestamp: new Date(msgTimestamp * 1000)
            });

            // Handle incoming message
            try {
              const { WhatsAppHandler } = await import('./WhatsAppHandler');
              await WhatsAppHandler.handleIncomingMessage(msg, this);
            } catch (e: any) {
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
  private extractMessageText(msg: proto.IWebMessageInfo): string | null {
    if (!msg.message) return null;

    // Unwrap ephemeral/viewOnce messages which Baileys might nest
    const content = getContentType(msg.message);
    let m = msg.message;

    if (content === 'ephemeralMessage') {
      m = msg.message.ephemeralMessage?.message || m;
    } else if (content === 'viewOnceMessage') {
      m = msg.message.viewOnceMessage?.message || m;
    } else if (content === 'documentWithCaptionMessage') {
      m = msg.message.documentWithCaptionMessage?.message || m;
    }

    if (!m) return null;

    return (
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.documentMessage?.caption ||
      null
    );
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
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

  /**
   * Format phone number for WhatsApp
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle Indonesian numbers
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62') && cleaned.length <= 12) {
      cleaned = '62' + cleaned;
    }

    // If it's already a full JID (like @lid or @s.whatsapp.net), don't append suffix
    if (phone.includes('@')) return phone;

    return `${cleaned}@s.whatsapp.net`;
  }

  /**
   * Send a text message
   */
  public async sendMessage(to: string, text: string, options?: SendMessageOptions): Promise<MessageResult> {
    return this.queueMessage(to, { text }, options);
  }

  /**
   * Send an image
   */
  public async sendImage(to: string, imagePath: string, caption?: string): Promise<MessageResult> {
    if (!fs.existsSync(imagePath)) {
      return { success: false, error: 'Image file not found' };
    }

    const imageBuffer = fs.readFileSync(imagePath);
    return this.queueMessage(to, {
      image: imageBuffer,
      caption: caption || undefined
    });
  }

  /**
   * Send a document
   */
  public async sendDocument(to: string, filePath: string, fileName?: string, caption?: string): Promise<MessageResult> {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = this.getMimeType(filePath);

    return this.queueMessage(to, {
      document: fileBuffer,
      mimetype: mimeType,
      fileName: fileName || path.basename(filePath),
      caption: caption || undefined
    });
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
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
  private queueMessage(to: string, content: AnyMessageContent, options?: SendMessageOptions): Promise<MessageResult> {
    return new Promise((resolve, reject) => {
      if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
        resolve({ success: false, error: 'Message queue is full' });
        return;
      }

      const queueItem: QueuedMessage = {
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
  private startQueueProcessor(): void {
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
  private async processQueue(): Promise<void> {
    // Safety processed count
    let processed = 0;

    while (this.messageQueue.length > 0 && this.isConnected) {
      const item = this.messageQueue.shift()!;
      processed++;

      try {
        this.log('debug', `📨 Processing message ${item.id} to ${item.to}`);
        const result = await this.sendMessageDirect(item.to, item.content, item.options);
        this.log('debug', `✅ Message sent ${item.id}`);
        item.resolve(result);
      } catch (error: any) {
        item.retries++;

        if (item.retries < item.maxRetries) {
          // Re-queue for retry
          this.messageQueue.push(item);
          this.log('warn', `⚠️ Message ${item.id} failed, retry ${item.retries}/${item.maxRetries}. Error: ${error.message}`);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          item.resolve({ success: false, error: error.message });
          this.log('error', `❌ Message ${item.id} failed after ${item.maxRetries} retries: ${error.message}`);
        }
      }

      // Wait before processing next message
      await new Promise(resolve => setTimeout(resolve, this.QUEUE_PROCESS_INTERVAL));

      // Yield event loop occasionally
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
  private async sendMessageDirect(to: string, content: AnyMessageContent, options?: SendMessageOptions): Promise<MessageResult> {
    if (!this.sock || !this.isConnected) {
      throw new Error('WhatsApp not connected');
    }

    try {
      // Show typing indicator
      if (options?.typing !== false) {
        // await this.sock.presenceSubscribe(to); // Optional, sometimes causes issues
        await this.sock.sendPresenceUpdate('composing', to);
        await new Promise(resolve => setTimeout(resolve, options?.typingDuration || 500));
      }

      // Send message
      const sent = await this.sock.sendMessage(to, content, {
        quoted: options?.quoted as any
      });

      // Clear typing
      await this.sock.sendPresenceUpdate('paused', to);

      this.messagesSent++;

      return {
        success: true,
        messageId: sent?.key?.id || undefined,
        timestamp: Date.now()
      };
    } catch (error: any) {
      this.log('error', `Failed to send message to ${to}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a number is registered on WhatsApp
   */
  public async isRegistered(phone: string): Promise<boolean> {
    if (!this.sock || !this.isConnected) return false;

    try {
      const jid = this.formatPhoneNumber(phone);
      const [result] = await this.sock.onWhatsApp(jid.replace('@s.whatsapp.net', ''));
      return result?.exists || false;
    } catch {
      return false;
    }
  }

  /**
   * Get service status
   */
  public getStatus(): WhatsAppStatus {
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
  public async restart(): Promise<void> {
    this.log('info', '🔄 Restarting WhatsApp service...');

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (e) { }
      this.sock = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.qrCode = null;
    this.qrDataUrl = null;
    this.reconnectAttempts = 0;

    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.initialize();
  }

  /**
   * Logout and clear session
   */
  public async logout(): Promise<void> {
    this.log('info', '🔒 Logging out...');

    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock.end(undefined);
        this.sock = null;
      }
    } catch (e: any) {
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
  private async clearSession(): Promise<void> {
    try {
      if (fs.existsSync(this.AUTH_DIR)) {
        fs.rmSync(this.AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(this.AUTH_DIR, { recursive: true });
      }
      this.log('info', '✅ Session cleared');
    } catch (e: any) {
      this.log('error', 'Failed to clear session:', e.message);
    }
  }

  /**
   * Get raw socket (for advanced usage)
   */
  public getSocket(): WASocket | null {
    return this.sock;
  }
}

// Export singleton instance
export const whatsappService = WhatsAppService.getInstance();

// Auto-initialize on module load
whatsappService.initialize().catch(err => {
  console.error('[WhatsApp] Failed to auto-initialize:', err.message);
});
