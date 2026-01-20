import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay, WASocket, MessageUpsertType, proto } from '@whiskeysockets/baileys';
import { EventEmitter } from 'events';
import pino from 'pino';
import path from 'path';
import fs from 'fs';

export const WhatsAppEvents = new EventEmitter();

export class WhatsAppBaileys {
    private static instance: WhatsAppBaileys;
    public socket: WASocket | null = null;
    private authState: any;
    private isReady: boolean = false;
    private isInitializing: boolean = false;
    public lastQR: string | null = null;

    private constructor() {
        // private to enforce singleton
    }

    public static getInstance(): WhatsAppBaileys {
        if (!WhatsAppBaileys.instance) {
            WhatsAppBaileys.instance = new WhatsAppBaileys();
        }
        return WhatsAppBaileys.instance;
    }

    public get client(): any {
        return this.socket;
    }

    /** Initialize the Baileys socket */
    public async initialize(): Promise<void> {
        if (this.isReady) return;
        if (this.isInitializing) return;
        this.isInitializing = true;
        try {
            const { state, saveCreds } = await useMultiFileAuthState(path.join(process.cwd(), '.baileys_auth'));
            this.authState = { state, saveCreds };
            const { version } = await fetchLatestBaileysVersion();
            this.socket = makeWASocket({
                version,
                auth: state,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: ['ISP Billing Support', 'Chrome', '1.0.0'], // Add browser identification
                connectTimeoutMs: 60000, // Increase timeout
            });

            this.socket.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    this.lastQR = qr;
                    WhatsAppEvents.emit('qr', qr);
                }
                if (connection === 'close') {
                    const error = lastDisconnect?.error as any;
                    const statusCode = error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    const errorMessage = error?.message || '';

                    console.error('[WhatsAppBaileys] 🚨 Connection closed. Reconnecting?', shouldReconnect, errorMessage);
                    this.isReady = false;

                    // Detect conflict specifically
                    if (errorMessage.includes('conflict')) {
                        console.warn('[WhatsAppBaileys] ⚠️ Conflict detected (Session mismatch). Clearing session and restarting...');
                        // Delay slightly to ensure cleanup
                        setTimeout(() => this.restart(), 1000);
                        return;
                    }

                    if (shouldReconnect) {
                        // Delay reconnect slightly
                        setTimeout(() => this.initialize(), 3000);
                    }
                } else if (connection === 'open') {
                    console.log('[WhatsAppBaileys] ✅ Connection opened');
                    this.isReady = true;
                    this.lastQR = null;
                    WhatsAppEvents.emit('ready');
                }
            });

            this.socket.ev.on('messages.upsert', async (msg) => {
                // console.log('[WhatsAppBaileys] DEBUG: messages.upsert received', msg.type, msg.messages.length);
                if (msg.type === 'notify') {
                    for (const m of msg.messages) {
                        WhatsAppEvents.emit('message', m);
                    }
                }
            });

            this.socket.ev.on('creds.update', async () => {
                try {
                    await this.authState.saveCreds();
                } catch (saveError: any) {
                    if (saveError.code === 'EACCES') {
                        console.error('[WhatsAppBaileys] 🚨 CRITICAL: Cannot save credentials due to permission error (EACCES).');
                    } else {
                        console.error('[WhatsAppBaileys] ❌ Error saving credentials:', saveError);
                    }
                }
            });

            // Wait until ready (or timeout after 45s)
            const timeout = 45000;
            const start = Date.now();
            while (!this.isReady && Date.now() - start < timeout) {
                await delay(1000);
            }

            // Start Watchdog after initialization attempt
            this.startWatchdog();

        } catch (error: any) {
            console.error('[WhatsAppBaileys] ❌ Initialization failed:', error);

            // Helpful hint for permission errors
            if (error.code === 'EACCES') {
                console.error('=================================================================');
                console.error('🚨 PERMISSION ERROR DETECTED');
                console.error('The application cannot write to the authentication directory.');
                console.error('Please run the following command on your server to fix permissions:');
                console.error('sudo chown -R www-data:www-data .baileys_auth && sudo chmod -R 775 .baileys_auth');
                console.error('=================================================================');
            }

            this.isReady = false;
        } finally {
            this.isInitializing = false;
        }
    }

    /** Watchdog to ensure connection stays alive */
    private startWatchdog() {
        // Clear existing interval to avoid duplicates
        if ((this as any).watchdogTimer) clearInterval((this as any).watchdogTimer);

        (this as any).watchdogTimer = setInterval(() => {
            // Check if supposed to be ready but socket is missing or closed
            if (this.isReady) {
                if (!this.socket) {
                    console.warn('[WhatsAppBaileys] 🚨 Watchdog: Socket missing while Ready=true. Reconnecting...');
                    this.isReady = false;
                    this.initialize();
                    return;
                }

                // Optional: Check ws state if accessible, otherwise rely on last activity timestamp if implemented
                // For now, we rely on the fact that if socket.ws is closed, 'close' event usually fires.
                // But sometimes it hangs. We can try a simple ping check (not supported directly in simple API)
            }
        }, 30000); // Check every 30 seconds
    }

    /** Send a text message or object content */
    public async sendMessage(to: string, content: string | any): Promise<any> {
        if (!this.socket) throw new Error('WhatsApp socket not initialized');
        const jid = this.formatJid(to);

        let result;
        if (typeof content === 'string') {
            result = await this.socket.sendMessage(jid, { text: content });
            WhatsAppEvents.emit('message_sent', { to, type: 'text', content });
        } else {
            result = await this.socket.sendMessage(jid, content);
            WhatsAppEvents.emit('message_sent', { to, type: 'complex', content });
        }
        return result;
    }


    /** Send an image with optional caption */
    public async sendImage(to: string, imagePath: string, caption?: string): Promise<void> {
        if (!this.socket) throw new Error('WhatsApp socket not initialized');
        const jid = this.formatJid(to);
        const buffer = fs.readFileSync(imagePath);
        const mime = require('mime-types').lookup(imagePath) || 'image/jpeg';
        await this.socket.sendMessage(jid, { image: buffer, mimetype: mime, caption: caption ?? '' } as any);
        WhatsAppEvents.emit('message_sent', { to, type: 'image', content: caption ?? 'Image' });
    }

    /** Restart the client (clear auth and reconnect) */
    public async restart(): Promise<void> {
        console.log('[WhatsAppBaileys] restarting...');
        if (this.socket) {
            try {
                await this.socket.logout();
            } catch (err) {
                console.warn('[WhatsAppBaileys] Logout failed (ignoring):', err);
            }
        }
        // delete auth folder
        const authPath = path.join(process.cwd(), '.baileys_auth');
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
        this.isReady = false;
        this.socket = null;
        await this.initialize();
    }

    /** Simple status getter */
    public getStatus() {
        return {
            ready: this.isReady,
            initializing: this.isInitializing,
            hasQRCode: !!this.lastQR,
        };
    }

    /** Static wrapper for sendMessage */
    public static async sendMessage(to: string, content: string | any): Promise<any> {
        return WhatsAppBaileys.getInstance().sendMessage(to, content);
    }

    /** Static wrapper for sendImage */
    public static async sendImage(to: string, imagePath: string, caption?: string): Promise<void> {
        return WhatsAppBaileys.getInstance().sendImage(to, imagePath, caption);
    }

    private formatJid(number: string): string {
        let clean = number.replace(/\D/g, '');
        if (clean.startsWith('0')) clean = '62' + clean.slice(1);
        if (!clean.endsWith('@s.whatsapp.net')) clean = clean + '@s.whatsapp.net';
        return clean;
    }
}
