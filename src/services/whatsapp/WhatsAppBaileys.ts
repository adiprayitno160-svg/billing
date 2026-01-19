import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay, WASocket, MessageRetryMap, MessageUpsertType, proto } from '@whiskeysockets/baileys';
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

    public get client() {
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
                    const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.error('[WhatsAppBaileys] 🚨 Connection closed. Reconnecting?', shouldReconnect, (lastDisconnect?.error as any)?.message);
                    this.isReady = false;
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
                await this.authState.saveCreds();
            });

            // Wait until ready (or timeout after 45s)
            const timeout = 45000;
            const start = Date.now();
            while (!this.isReady && Date.now() - start < timeout) {
                await delay(1000);
            }
        } catch (error) {
            console.error('[WhatsAppBaileys] ❌ Initialization failed:', error);
            this.isReady = false;
        } finally {
            this.isInitializing = false;
        }
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
            await this.socket.logout();
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

    private formatJid(number: string): string {
        let clean = number.replace(/\D/g, '');
        if (clean.startsWith('0')) clean = '62' + clean.slice(1);
        if (!clean.endsWith('@s.whatsapp.net')) clean = clean + '@s.whatsapp.net';
        return clean;
    }
}
