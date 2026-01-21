import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

export const WhatsAppEvents = new EventEmitter();

export class WhatsAppClient {
    private static instance: WhatsAppClient;
    private static LOCK_FILE = path.resolve(process.cwd(), '.whatsapp_lock');

    public client: Client | null = null;
    public lastQR: string | null = null;
    private isReady: boolean = false;
    private initializing: boolean = false;

    private constructor() { }

    public static getInstance(): WhatsAppClient {
        if (!WhatsAppClient.instance) {
            WhatsAppClient.instance = new WhatsAppClient();
        }
        return WhatsAppClient.instance;
    }

    /** Ensure only one instance runs */
    private async ensureSingleInstance(): Promise<void> {
        if (fs.existsSync(WhatsAppClient.LOCK_FILE)) {
            const pid = Number(fs.readFileSync(WhatsAppClient.LOCK_FILE, 'utf8'));
            try {
                process.kill(pid, 0);
                throw new Error(`WhatsApp client already running (PID ${pid})`);
            } catch {
                // stale lock, remove it
                fs.unlinkSync(WhatsAppClient.LOCK_FILE);
            }
        }
        fs.writeFileSync(WhatsAppClient.LOCK_FILE, process.pid.toString(), 'utf8');
    }

    private async removeLock(): Promise<void> {
        if (fs.existsSync(WhatsAppClient.LOCK_FILE)) {
            fs.unlinkSync(WhatsAppClient.LOCK_FILE);
        }
    }

    /** Clean old session folder (optional, can be toggled via env) */
    private async cleanAuthFolder(): Promise<void> {
        const authPath = path.join(process.cwd(), '.whatsapp_auth');
        try {
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
                console.log('[WhatsAppClient] Cleaned .whatsapp_auth folder');
            }
        } catch (e) {
            console.warn('[WhatsAppClient] Failed to clean auth folder:', (e as any).message);
        }
    }

    public async initialize(): Promise<void> {
        if (this.isReady || this.initializing) {
            console.log('[WhatsAppClient] Already ready or initializing.');
            return;
        }
        this.initializing = true;
        this.lastQR = null;

        await this.ensureSingleInstance();
        await this.cleanAuthFolder();

        try {
            console.log('[WhatsAppClient] Initializing with whatsapp-web.js...');
            const sessionPath = path.join(process.cwd(), '.whatsapp_auth');
            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            this.client = new Client({
                restartOnAuthFail: true,
                authStrategy: new LocalAuth({ clientId: 'billing_client', dataPath: sessionPath }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--disable-web-security',
                    ],
                },
            });

            // Event listeners
            this.client.on('qr', (qr) => {
                console.log('[WhatsAppClient] 🆕 QR Code received');
                this.lastQR = qr;
                WhatsAppEvents.emit('qr', qr);
            });

            this.client.on('ready', () => {
                console.log('[WhatsAppClient] ✅ Ready');
                this.isReady = true;
                this.initializing = false;
                this.lastQR = null;
                WhatsAppEvents.emit('ready');
            });

            this.client.on('authenticated', () => {
                console.log('[WhatsAppClient] ✅ Authenticated');
            });

            this.client.on('auth_failure', (msg) => {
                console.error('[WhatsAppClient] ❌ Auth failure:', msg);
                this.isReady = false;
                this.initializing = false;
            });

            this.client.on('disconnected', (reason) => {
                console.warn('[WhatsAppClient] ⚠️ Disconnected:', reason);
                this.isReady = false;
                this.initializing = false;
                setTimeout(() => this.restart().catch(console.error), 3000);
            });

            this.client.on('message', (msg) => {
                console.log(`[WhatsAppClient] 📨 New Message from ${msg.from}: ${msg.body.substring(0, 30)}...`);
                const { databasePool } = require('../../db/pool');
                databasePool
                    .query(
                        'INSERT INTO whatsapp_bot_messages (phone_number, message_content, direction, status) VALUES (?, ?, ?, ?)',
                        [msg.from.replace(/\\D/g, ''), msg.body, 'inbound', 'sent']
                    )
                    .catch((err: any) => console.warn('[WhatsAppClient] DB log error (non-fatal):', err.message));
                WhatsAppEvents.emit('message', msg);
            });

            await this.client.initialize();
        } catch (error) {
            console.error('[WhatsAppClient] Init error:', error);
            this.initializing = false;
        }
    }

    public getStatus() {
        return { ready: this.isReady, initializing: this.initializing };
    }

    public async sendMessage(to: string, message: string): Promise<Message> {
        if (!this.client || !this.isReady) {
            throw new Error('WhatsApp client not ready');
        }
        // Format JID correctly
        let chatId = to.replace(/\\D/g, '');
        if (chatId.startsWith('0')) chatId = '62' + chatId.substring(1);
        if (!chatId.includes('@')) chatId = `${chatId}@c.us`;
        console.log(`[WhatsAppClient] Sending to JID: ${chatId}`);
        let lastError: any;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                await new Promise((r) => setTimeout(r, 500));
                const result = await this.client.sendMessage(chatId, message);
                console.log(`[WhatsAppClient] ✅ Message sent successfully on attempt ${attempt}`);
                return result;
            } catch (err: any) {
                lastError = err;
                console.warn(`[WhatsAppClient] ⚠️ Send attempt ${attempt} failed:`, err.message?.substring(0, 100));
                if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
            }
        }
        throw lastError;
    }

    /** Restart client and clear session */
    public async restart(): Promise<void> {
        console.log('[WhatsAppClient] Restarting...');
        if (this.client) {
            try {
                await this.client.destroy();
            } catch (e) {
                console.error('Error destroying client:', e);
            }
        }
        const sessionPath = path.join(process.cwd(), '.whatsapp_auth');
        try {
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log('[WhatsAppClient] Session cleared');
            }
        } catch (error) {
            console.error('Error clearing session:', error);
        }
        this.client = null;
        this.isReady = false;
        this.initializing = false;
        this.lastQR = null;
        await this.initialize();
    }

    /** Graceful destroy for shutdown */
    public async destroy(): Promise<void> {
        console.log('[WhatsAppClient] 🛑 Destroying client for graceful shutdown...');
        if (this.client) {
            try {
                await this.client.destroy();
                console.log('[WhatsAppClient] ✅ Client destroyed successfully');
            } catch (e) {
                console.error('[WhatsAppClient] Error during destroy:', e);
            }
        }
        await this.removeLock();
        this.client = null;
        this.isReady = false;
        this.initializing = false;
        this.lastQR = null;
    }
}
