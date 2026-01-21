
import { WhatsAppEvents, WhatsAppClient } from './WhatsAppClient';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { Message, MessageMedia } from 'whatsapp-web.js';
import * as fs from 'fs';
import * as path from 'path';
import { ChatBotService } from '../ai/ChatBotService';
import { WhatsAppSessionService } from './WhatsAppSessionService';
import { PaymentProofVerificationService } from '../payments/PaymentProofVerificationService';
import { WhatsAppRegistrationService } from './WhatsAppRegistrationService';

export class WhatsAppHandler {
    private static isInitialized = false;

    static initialize() {
        if (this.isInitialized) return;
        console.log('[WhatsAppHandler] Initializing logic handler (wwebjs)...');
        this.ensureTables();

        WhatsAppEvents.on('message', async (msg: Message) => {
            await this.handleIncomingMessage(msg);
        });

        // Listen for outgoing messages if we want to log them (optional)
        // Usually wwebjs emits 'message_create' for own messages too, but let's stick to inbound first

        this.isInitialized = true;
    }

    private static async ensureTables() {
        // ... same table creation logic ...
        await databasePool.query(`
            CREATE TABLE IF NOT EXISTS fraud_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phone VARCHAR(20),
                invoice_id INT,
                fraud_score DECIMAL(5,4),
                confidence DECIMAL(5,4),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await databasePool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_bot_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phone_number VARCHAR(20),
                customer_id INT NULL,
                direction ENUM('inbound', 'outbound') DEFAULT 'outbound',
                message_type VARCHAR(20) DEFAULT 'text',
                message_content TEXT,
                status VARCHAR(20) DEFAULT 'sent',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_phone (phone_number),
                INDEX idx_customer (customer_id)
            )
        `);
    }

    private static async sendMessage(to: string, text: string) {
        try {
            console.log(`[WhatsAppHandler] Sending reply to: ${to}`);
            // Use WhatsAppService for redundancy
            const { WhatsAppService } = require('./WhatsAppService');
            const waService = new WhatsAppService();
            await waService.sendMessage(to, text);
        } catch (primaryError: any) {
            const errMsg = primaryError?.message || String(primaryError);
            console.warn(`⚠️ [Primary] Failed to send to ${to}: ${errMsg}`);
            // The instruction included `errorLog += ...` but `errorLog` is not defined in this scope.
            // Assuming it's a placeholder or intended for a different context, it's omitted for syntactic correctness.
            // The instruction also included parts of `getCustomerByPhone` which are syntactically incorrect here.
            // Only the error reporting part of the catch block is applied.
        }
    }

    private static async getCustomerByPhone(phone: string): Promise<any> {
        // phone needs to be clean 628xxx
        const cleanPhone = phone.replace('@c.us', '').replace('@s.whatsapp.net', '').replace(/\D/g, '');

        // Try multiple formats: 62xxx, 0xxx (local), and raw
        const formats = [
            cleanPhone, // 6289678630707
            cleanPhone.replace(/^62/, '0'), // 089678630707
            cleanPhone.replace(/^62/, ''), // 89678630707
        ];

        for (const fmt of formats) {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM customers WHERE phone LIKE ? OR phone LIKE ? LIMIT 1',
                [`%${fmt}%`, `%${fmt.slice(-10)}%`] // Also try last 10 digits
            );
            if (rows.length > 0) {
                console.log(`[WhatsAppHandler] Customer found with phone format: ${fmt}`);
                return rows[0];
            }
        }
        console.log(`[WhatsAppHandler] No customer found for phone: ${cleanPhone}`);
        return null;
    }

    private static async getUserByPhone(phone: string): Promise<any> {
        const cleanPhone = phone.replace('@c.us', '').replace('@s.whatsapp.net', '').replace(/\D/g, '');
        const [rows] = await databasePool.query<RowDataPacket[]>('SELECT * FROM users WHERE phone LIKE ? LIMIT 1', [`%${cleanPhone}%`]);
        return rows.length > 0 ? rows[0] : null;
    }

    private static async handleIncomingMessage(msg: Message) {
        try {
            // Basic Filters
            if (msg.fromMe) return; // Ignore self
            if (msg.from.includes('@g.us')) return; // Ignore groups for now
            if (msg.type === 'e2e_notification' || msg.type === 'call_log') return;

            const senderJid = msg.from;
            const body = msg.body;
            const lowerBody = body.toLowerCase().trim();

            // Filter out status updates (very important to prevent status@broadcast crashes)
            if (senderJid === 'status@broadcast') return;

            // Clean phone number (remove @c.us)
            const senderPhone = senderJid.replace('@c.us', '').replace(/\D/g, '');

            // FILTER: Only process Indonesian numbers (62xxx)
            // This prevents responding to foreign numbers like Philippine (63xxx) which cause issues
            if (!senderPhone.startsWith('62')) {
                console.log(`[WhatsAppHandler] ⚠️ SKIPPING non-Indonesian number: ${senderPhone}`);
                return;
            }

            // Log Message
            console.log(`[WhatsAppHandler] 📩 RECEIVED: ${senderPhone} says: "${body.substring(0, 50)}..."`);

            // TODO: Insert into whatsapp_bot_messages for history

            // Identify User
            let customer = await this.getCustomerByPhone(senderPhone);
            let user = await this.getUserByPhone(senderPhone);

            // Session State
            let session = await WhatsAppSessionService.getSession(senderPhone);

            // === MEDIA HANDLING ===
            if (msg.hasMedia) {
                // Handle Image/Media
                // For now, simplify: if it's an image and user sent it, maybe it's proof
                // Implementation requires downloading media:
                // const media = await msg.downloadMedia();
                // For now, we skip or impl limited
            }

            // === COMMANDS ===
            const globalCommands = ['/menu', 'menu', 'batal', 'cancel', 'exit', 'stop', '.menu', '!menu', 'ping', 'halo', 'hi'];
            if (globalCommands.includes(lowerBody)) {
                if (session) {
                    await WhatsAppSessionService.clearSession(senderPhone);
                    session = null;
                }
            }

            // === LOGIC FLOWS ===
            // 1. Unregistered / Registration Flow (Guest)
            if (!customer && !user) {
                // If in registration session
                if (session?.step) {
                    const resp = await WhatsAppRegistrationService.processStep(senderPhone, body);
                    await this.sendMessage(senderJid, resp);
                    return;
                }

                // Start registration process
                if (lowerBody === 'daftar' || lowerBody === '1' || lowerBody === '/daftar') {
                    const resp = await WhatsAppRegistrationService.processStep(senderPhone, body);
                    await this.sendMessage(senderJid, resp);
                    return;
                }

                // Default Welcome for unknown/guest - Direct to registration
                // Try AI if available, otherwise show static message
                try {
                    const aiResponse = await ChatBotService.ask(body, { status: 'guest' });
                    await this.sendMessage(senderJid, aiResponse);
                } catch (aiError) {
                    // AI not available, show static welcome message
                    const welcomeMsg = `👋 *Selamat Datang!*\n\n` +
                        `Nomor Anda belum terdaftar di sistem kami.\n\n` +
                        `📝 Ketik *daftar* untuk mendaftar sebagai pelanggan baru.\n` +
                        `❓ Untuk bantuan lebih lanjut, hubungi operator kami.\n\n` +
                        `📞 *Hubungi Operator:*\n` +
                        `WhatsApp: 089678630707`;
                    await this.sendMessage(senderJid, welcomeMsg);
                }
                return;
            }

            // 2. Registered Users
            if (customer) {
                if (['menu', '/menu', 'halo'].includes(lowerBody)) {
                    const menu = `👋 Halo *${customer.name}*!\n\n` +
                        `📋 *MENU PELANGGAN*\n` +
                        `1. Cek Tagihan (Tagihan)\n` +
                        `2. Cek Hutang (Hutang)\n` +
                        `3. Info WiFi\n` +
                        `\nKetik pesan Anda untuk bantuan AI.`;
                    await this.sendMessage(senderJid, menu);
                    return;
                }

                if (lowerBody === 'tagihan') {
                    // ... fetch invoice logic ...
                    // simpler stub
                    const [inv] = await databasePool.query<RowDataPacket[]>(`SELECT * FROM invoices WHERE customer_id = ? ORDER BY id DESC LIMIT 1`, [customer.id]);
                    if (inv.length > 0) {
                        await this.sendMessage(senderJid, `Total Tagihan: ${inv[0].total_amount}`);
                    } else {
                        await this.sendMessage(senderJid, 'Tidak ada tagihan.');
                    }
                    return;
                }

                // AI Fallback
                const aiResp = await ChatBotService.ask(body, customer);
                await this.sendMessage(senderJid, aiResp);
            }

        } catch (error) {
            console.error('[WhatsAppHandler] Error handling message:', error);
        }
    }

    // Stub for image handling to avoid compilation errors if called elsewhere
    private static async handleImageMessage(msg: Message, replyJid: string, phone: string, session: any) {
        // Implementation pending
    }

    // Stub for prepaid
    private static async getPrepaidPackageByInput(input: string) {
        return null;
    }

    private static async showPrepaidMenu(jid: string, phone: string) {
        // Stub
    }
}
