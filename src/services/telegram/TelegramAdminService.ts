/**
 * Telegram Admin Service
 * Enhanced Telegram Bot for Admin & Teknisi
 * Features: Real-time monitoring, incident management, notifications
 */

import TelegramBot from 'node-telegram-bot-api';
import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface TelegramUser {
    id: number;
    telegram_chat_id: string;
    telegram_username: string;
    first_name: string;
    last_name?: string;
    role: 'admin' | 'teknisi' | 'kasir' | 'superadmin';
    area_coverage: string[];
    is_active: boolean;
    notification_enabled: boolean;
}

interface NotificationPayload {
    type: 'downtime' | 'sla_breach' | 'payment' | 'invoice' | 'system' | 'custom';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    targetRole?: 'admin' | 'teknisi' | 'kasir' | 'all';
    targetArea?: string;
    customerId?: number;
    metadata?: any;
}

export class TelegramAdminService {
    private bot: TelegramBot | null = null;
    private botToken: string;
    private isInitialized: boolean = false;
    private messageQueue: any[] = [];
    
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
        
        // Check if token is valid (not empty and not placeholder)
        const isValidToken = this.botToken && 
                            this.botToken.length > 10 && 
                            !this.botToken.includes('your_') &&
                            !this.botToken.includes('YOUR_') &&
                            this.botToken !== 'your_telegram_bot_token_here';
        
        if (isValidToken) {
            this.initializeBot();
        } else {
            console.warn('[TelegramAdmin] ⚠️ Bot token not configured or invalid.');
            console.warn('[TelegramAdmin] 📝 Silakan atur token melalui: Settings > Telegram');
            console.warn('[TelegramAdmin] 🔗 Cara mendapatkan token: https://t.me/BotFather');
        }
    }
    
    /**
     * Initialize Telegram bot with polling
     */
    private initializeBot(): void {
        try {
            this.bot = new TelegramBot(this.botToken, { 
                polling: {
                    interval: 300,
                    autoStart: true,
                    params: {
                        timeout: 10
                    }
                }
            });
            
            this.setupCommands();
            this.setupCallbackHandlers();
            this.setupErrorHandling();
            
            this.isInitialized = true;
            console.log('[TelegramAdmin] ✅ Bot initialized successfully');
            
            // Log chat logs
            this.logSystemMessage('Bot started successfully');
            
        } catch (error) {
            console.error('[TelegramAdmin] ❌ Failed to initialize bot:', error);
        }
    }
    
    /**
     * Setup all bot commands
     */
    private setupCommands(): void {
        if (!this.bot) return;
        
        // Command: /start
        this.bot.onText(/\/start/, async (msg) => {
            await this.handleStart(msg);
        });
        
        // Command: /register
        this.bot.onText(/\/register (.+)/, async (msg, match) => {
            await this.handleRegister(msg, match?.[1] || '');
        });
        
        // Command: /help
        this.bot.onText(/\/help/, async (msg) => {
            await this.handleHelp(msg);
        });
        
        // Command: /status
        this.bot.onText(/\/status/, async (msg) => {
            await this.handleStatus(msg);
        });
        
        // Command: /incidents
        this.bot.onText(/\/incidents( .*)?/, async (msg, match) => {
            await this.handleIncidents(msg, match?.[1]?.trim());
        });
        
        // Command: /mytickets
        this.bot.onText(/\/mytickets/, async (msg) => {
            await this.handleMyTickets(msg);
        });
        
        // Command: /customers
        this.bot.onText(/\/customers (.+)/, async (msg, match) => {
            await this.handleCustomerSearch(msg, match?.[1] || '');
        });
        
        // Command: /offline
        this.bot.onText(/\/offline( .*)?/, async (msg, match) => {
            await this.handleOfflineCustomers(msg, match?.[1]?.trim());
        });
        
        // Command: /stats
        this.bot.onText(/\/stats/, async (msg) => {
            await this.handleStats(msg);
        });
        
        // Command: /invoice
        this.bot.onText(/\/invoice (.+)/, async (msg, match) => {
            await this.handleInvoice(msg, match?.[1] || '');
        });
        
        // Command: /payment
        this.bot.onText(/\/payment (.+)/, async (msg, match) => {
            await this.handlePayment(msg, match?.[1] || '');
        });
        
        // Command: /areas
        this.bot.onText(/\/areas/, async (msg) => {
            await this.handleAreas(msg);
        });
        
        // Command: /performance
        this.bot.onText(/\/performance( .*)?/, async (msg, match) => {
            await this.handlePerformance(msg, match?.[1]?.trim());
        });
        
        // Command: /settings
        this.bot.onText(/\/settings/, async (msg) => {
            await this.handleSettings(msg);
        });
        
        console.log('[TelegramAdmin] Commands registered');
    }
    
    /**
     * Setup callback query handlers (button clicks)
     */
    private setupCallbackHandlers(): void {
        if (!this.bot) return;
        
        this.bot.on('callback_query', async (query) => {
            const chatId = query.message?.chat.id;
            const data = query.data;
            
            if (!chatId || !data) return;
            
            try {
                if (data.startsWith('assign_')) {
                    await this.handleAssignIncident(chatId, data);
                } else if (data.startsWith('ack_')) {
                    await this.handleAcknowledgeIncident(chatId, data);
                } else if (data.startsWith('complete_')) {
                    await this.handleCompleteIncident(chatId, data);
                } else if (data.startsWith('toggle_notif')) {
                    await this.handleToggleNotifications(chatId);
                } else if (data.startsWith('quick_')) {
                    await this.handleQuickReply(chatId, data);
                }
                
                await this.bot?.answerCallbackQuery(query.id);
                
            } catch (error) {
                console.error('[TelegramAdmin] Callback error:', error);
                await this.bot?.answerCallbackQuery(query.id, {
                    text: '❌ Terjadi kesalahan',
                    show_alert: true
                });
            }
        });
    }
    
    /**
     * Setup error handling
     */
    private setupErrorHandling(): void {
        if (!this.bot) return;
        
        this.bot.on('polling_error', (error: any) => {
            // Check for 401 Unauthorized error (invalid token)
            if (error.message && error.message.includes('401')) {
                console.error('[TelegramAdmin] ❌ FATAL: Invalid Bot Token (401 Unauthorized)');
                console.error('[TelegramAdmin] Bot token tidak valid. Silakan periksa konfigurasi token di Settings > Telegram');
                console.error('[TelegramAdmin] Stopping bot to prevent further errors...');
                
                // Stop polling to prevent spam
                if (this.bot) {
                    try {
                        this.bot.stopPolling();
                        this.isInitialized = false;
                        console.log('[TelegramAdmin] Bot polling stopped.');
                    } catch (stopError) {
                        console.error('[TelegramAdmin] Error stopping bot:', stopError);
                    }
                }
                return;
            }
            
            // Log other polling errors
            console.error('[TelegramAdmin] Polling error:', error.message);
        });
        
        this.bot.on('error', (error) => {
            console.error('[TelegramAdmin] Bot error:', error.message);
        });
    }
    
    // ==========================================
    // COMMAND HANDLERS
    // ==========================================
    
    /**
     * Handle /start command
     */
    private async handleStart(msg: TelegramBot.Message): Promise<void> {
        const chatId = msg.chat.id;
        
        const message = 
            `🤖 *Selamat Datang di ISP Billing Bot*\n\n` +
            `Bot ini membantu Admin dan Teknisi untuk:\n` +
            `• 📊 Monitoring real-time\n` +
            `• 🔔 Notifikasi incident otomatis\n` +
            `• 📋 Manajemen tiket\n` +
            `• 💰 Info tagihan & pembayaran\n` +
            `• 📈 Statistik performa\n\n` +
            `*Untuk memulai:*\n` +
            `/register <kode_undangan>\n\n` +
            `Hubungi admin untuk mendapatkan kode undangan.`;
        
        await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        await this.logChatMessage(chatId, 'command', '/start', message, true);
    }
    
    /**
     * Handle /register command
     */
    private async handleRegister(msg: TelegramBot.Message, inviteCode: string): Promise<void> {
        const chatId = msg.chat.id;
        const username = msg.from?.username || '';
        const firstName = msg.from?.first_name || '';
        const lastName = msg.from?.last_name || '';
        
        if (!inviteCode) {
            await this.sendMessage(chatId, '❌ Format salah. Gunakan: /register <kode_undangan>');
            return;
        }
        
        try {
            // Check if already registered
            const [existing] = await pool.query<RowDataPacket[]>(`
                SELECT id FROM telegram_users
                WHERE telegram_chat_id = ? AND is_active = 1
            `, [chatId.toString()]);
            
            if (existing.length > 0) {
                await this.sendMessage(chatId, '⚠️ Anda sudah terdaftar. Gunakan /status untuk melihat info akun.');
                return;
            }
            
            // Check invite code
            const [rows] = await pool.query<RowDataPacket[]>(`
                SELECT id, role, area_coverage, invite_expires_at
                FROM telegram_users
                WHERE invite_code = ? AND is_active = 0
            `, [inviteCode]);
            
            if (rows.length === 0) {
                await this.sendMessage(chatId, '❌ Kode undangan tidak valid atau sudah digunakan.');
                await this.logChatMessage(chatId, 'command', '/register', 'Invalid invite code', false);
                return;
            }
            
            const user = rows[0];
            
            // Check expiration
            if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
                await this.sendMessage(chatId, '❌ Kode undangan sudah kadaluarsa.');
                return;
            }
            
            // Activate user
            await pool.query(`
                UPDATE telegram_users
                SET 
                    telegram_chat_id = ?,
                    telegram_username = ?,
                    first_name = ?,
                    last_name = ?,
                    is_active = 1,
                    registered_at = NOW(),
                    last_active_at = NOW()
                WHERE id = ?
            `, [chatId.toString(), username, firstName, lastName, user.id]);
            
            const areaCoverage = JSON.parse(user.area_coverage || '[]');
            const roleEmoji = user.role === 'admin' ? '👨‍💼' : user.role === 'teknisi' ? '🔧' : '💰';
            
            const message = 
                `✅ *Registrasi Berhasil!*\n\n` +
                `${roleEmoji} Role: *${user.role.toUpperCase()}*\n` +
                `📍 Area: ${areaCoverage.length > 0 ? areaCoverage.join(', ') : 'Semua area'}\n\n` +
                `Anda akan menerima notifikasi otomatis sesuai area Anda.\n\n` +
                `Gunakan /help untuk melihat perintah yang tersedia.`;
            
            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            await this.logChatMessage(chatId, 'command', '/register', message, true);
            
            console.log(`[TelegramAdmin] User registered: ${username} (${user.role})`);
            
        } catch (error) {
            console.error('[TelegramAdmin] Registration error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan saat registrasi. Silakan coba lagi.');
        }
    }
    
    /**
     * Handle /help command
     */
    private async handleHelp(msg: TelegramBot.Message): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user) {
                await this.sendMessage(chatId, '❌ Anda belum terdaftar. Gunakan /register untuk mendaftar.');
                return;
            }
            
            let commands = `📖 *Perintah yang Tersedia*\n\n`;
            
            // Common commands
            commands += `*Umum:*\n`;
            commands += `/start - Memulai bot\n`;
            commands += `/help - Bantuan\n`;
            commands += `/status - Status akun Anda\n`;
            commands += `/settings - Pengaturan notifikasi\n\n`;
            
            // Role-specific commands
            if (user.role === 'admin' || user.role === 'superadmin') {
                commands += `*Admin:*\n`;
                commands += `/stats - Statistik hari ini\n`;
                commands += `/incidents - Lihat incident aktif\n`;
                commands += `/offline [area] - Customer offline\n`;
                commands += `/customers <nama> - Cari customer\n`;
                commands += `/invoice <id> - Cek tagihan\n`;
                commands += `/payment <id> - Cek pembayaran\n`;
                commands += `/performance - Performa teknisi\n`;
                commands += `/areas - Daftar area\n\n`;
            }
            
            if (user.role === 'teknisi') {
                commands += `*Teknisi:*\n`;
                commands += `/mytickets - Tiket saya\n`;
                commands += `/incidents [area] - Incident aktif\n`;
                commands += `/offline [area] - Customer offline\n`;
                commands += `/customers <nama> - Cari customer\n`;
                commands += `/areas - Daftar area\n\n`;
            }
            
            if (user.role === 'kasir') {
                commands += `*Kasir:*\n`;
                commands += `/invoice <id> - Cek tagihan\n`;
                commands += `/payment <id> - Cek pembayaran\n`;
                commands += `/customers <nama> - Cari customer\n\n`;
            }
            
            commands += `💡 *Tips:* Anda akan menerima notifikasi otomatis untuk incident di area Anda.`;
            
            await this.sendMessage(chatId, commands, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('[TelegramAdmin] Help error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    /**
     * Handle /status command
     */
    private async handleStatus(msg: TelegramBot.Message): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user) {
                await this.sendMessage(chatId, '❌ Anda belum terdaftar. Gunakan /register untuk mendaftar.');
                return;
            }
            
            const areaCoverage = user.area_coverage || [];
            
            // Get user stats
            const [stats] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(DISTINCT tcl.id) as total_messages,
                    COUNT(DISTINCT CASE WHEN tcl.message_type = 'command' THEN tcl.id END) as total_commands
                FROM telegram_users tu
                LEFT JOIN telegram_chat_logs tcl ON tu.id = tcl.user_id
                WHERE tu.telegram_chat_id = ?
            `, [chatId.toString()]);
            
            // Get assigned incidents (for teknisi)
            let assignedIncidents = 0;
            if (user.role === 'teknisi') {
                const [incidents] = await pool.query<RowDataPacket[]>(`
                    SELECT COUNT(*) as count
                    FROM telegram_incident_assignments
                    WHERE technician_user_id = ? AND status IN ('assigned', 'acknowledged', 'working')
                `, [user.id]);
                assignedIncidents = incidents[0].count;
            }
            
            const roleEmoji = user.role === 'admin' ? '👨‍💼' : user.role === 'teknisi' ? '🔧' : '💰';
            const notifStatus = user.notification_enabled ? '🔔 Aktif' : '🔕 Nonaktif';
            
            let message = 
                `📊 *Status Akun Anda*\n\n` +
                `${roleEmoji} Role: *${user.role.toUpperCase()}*\n` +
                `👤 Nama: ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}\n` +
                `📍 Area: ${areaCoverage.length > 0 ? areaCoverage.join(', ') : 'Semua area'}\n` +
                `${notifStatus}\n\n` +
                `📈 *Aktivitas:*\n` +
                `• Total pesan: ${stats[0].total_messages}\n` +
                `• Total command: ${stats[0].total_commands}\n`;
            
            if (user.role === 'teknisi') {
                message += `• Tiket aktif: ${assignedIncidents}\n`;
            }
            
            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('[TelegramAdmin] Status error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    /**
     * Handle /incidents command
     */
    private async handleIncidents(msg: TelegramBot.Message, area?: string): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user) {
                await this.sendMessage(chatId, '❌ Anda belum terdaftar.');
                return;
            }
            
            if (user.role !== 'admin' && user.role !== 'teknisi' && user.role !== 'superadmin') {
                await this.sendMessage(chatId, '❌ Anda tidak memiliki akses ke fitur ini.');
                return;
            }
            
            // Get active incidents
            let query = `
                SELECT 
                    si.id,
                    c.customer_id,
                    c.name AS customer_name,
                    c.area,
                    c.phone,
                    si.start_time,
                    TIMESTAMPDIFF(MINUTE, si.start_time, NOW()) as duration_minutes,
                    tia.status as assignment_status,
                    tu.first_name as technician_name
                FROM sla_incidents si
                JOIN customers c ON si.customer_id = c.id
                LEFT JOIN telegram_incident_assignments tia ON si.id = tia.incident_id 
                    AND tia.status IN ('assigned', 'acknowledged', 'working')
                LEFT JOIN telegram_users tu ON tia.technician_user_id = tu.id
                WHERE si.status = 'ongoing'
            `;
            
            const params: any[] = [];
            
            // Filter by area for teknisi or if specified
            if (area) {
                query += ` AND c.area = ?`;
                params.push(area);
            } else if (user.role === 'teknisi' && user.area_coverage.length > 0) {
                query += ` AND c.area IN (?)`;
                params.push(user.area_coverage);
            }
            
            query += ` ORDER BY duration_minutes DESC LIMIT 20`;
            
            const [incidents] = await pool.query<RowDataPacket[]>(query, params);
            
            if (incidents.length === 0) {
                await this.sendMessage(chatId, '✅ Tidak ada incident aktif saat ini.');
                return;
            }
            
            let message = `🔴 *Incident Aktif (${incidents.length})*\n\n`;
            
            incidents.forEach((inc: any, index: number) => {
                const statusIcon = inc.assignment_status ? '👷' : '⚠️';
                const techInfo = inc.technician_name ? ` (${inc.technician_name})` : '';
                
                message += `${index + 1}. ${statusIcon} *${inc.customer_name}*\n`;
                message += `   ID: ${inc.customer_id} | 📍 ${inc.area || 'N/A'}\n`;
                message += `   ⏱️ ${inc.duration_minutes} menit${techInfo}\n`;
                message += `   📞 ${inc.phone || '-'}\n\n`;
            });
            
            message += `_Update: ${new Date().toLocaleString('id-ID')}_`;
            
            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('[TelegramAdmin] Incidents error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    /**
     * Handle /mytickets command
     */
    private async handleMyTickets(msg: TelegramBot.Message): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user || user.role !== 'teknisi') {
                await this.sendMessage(chatId, '❌ Perintah ini hanya untuk teknisi.');
                return;
            }
            
            const [tickets] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    tia.id,
                    tia.incident_id,
                    tia.status,
                    tia.assigned_at,
                    c.customer_id,
                    c.name as customer_name,
                    c.area,
                    c.phone,
                    TIMESTAMPDIFF(MINUTE, tia.assigned_at, NOW()) as age_minutes
                FROM telegram_incident_assignments tia
                JOIN sla_incidents si ON tia.incident_id = si.id
                JOIN customers c ON si.customer_id = c.id
                WHERE tia.technician_user_id = ?
                    AND tia.status IN ('assigned', 'acknowledged', 'working')
                ORDER BY tia.assigned_at ASC
            `, [user.id]);
            
            if (tickets.length === 0) {
                await this.sendMessage(chatId, '✅ Anda tidak memiliki tiket aktif saat ini.');
                return;
            }
            
            let message = `📋 *Tiket Anda (${tickets.length})*\n\n`;
            
            tickets.forEach((ticket: any, index: number) => {
                const statusEmoji = 
                    ticket.status === 'assigned' ? '📌' :
                    ticket.status === 'acknowledged' ? '👀' :
                    ticket.status === 'working' ? '🔧' : '✅';
                
                message += `${index + 1}. ${statusEmoji} *${ticket.customer_name}*\n`;
                message += `   ID: ${ticket.customer_id} | 📍 ${ticket.area}\n`;
                message += `   Status: ${ticket.status}\n`;
                message += `   ⏱️ ${ticket.age_minutes} menit lalu\n`;
                message += `   📞 ${ticket.phone || '-'}\n\n`;
            });
            
            message += `_Gunakan button di notifikasi untuk update status_`;
            
            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('[TelegramAdmin] MyTickets error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    /**
     * Handle /customers command
     */
    private async handleCustomerSearch(msg: TelegramBot.Message, query: string): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user) {
                await this.sendMessage(chatId, '❌ Anda belum terdaftar.');
                return;
            }
            
            if (!query) {
                await this.sendMessage(chatId, '❌ Format: /customers <nama atau ID>');
                return;
            }
            
            const [customers] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    customer_id,
                    name,
                    area,
                    phone,
                    address,
                    status,
                    package_name,
                    monthly_fee
                FROM customers
                WHERE (name LIKE ? OR customer_id LIKE ?)
                    AND is_deleted = 0
                LIMIT 10
            `, [`%${query}%`, `%${query}%`]);
            
            if (customers.length === 0) {
                await this.sendMessage(chatId, '❌ Customer tidak ditemukan.');
                return;
            }
            
            let message = `🔍 *Hasil Pencarian (${customers.length})*\n\n`;
            
            customers.forEach((cust: any, index: number) => {
                const statusIcon = cust.status === 'active' ? '✅' : '⚠️';
                
                message += `${index + 1}. ${statusIcon} *${cust.name}*\n`;
                message += `   ID: ${cust.customer_id}\n`;
                message += `   📍 ${cust.area || 'N/A'} | 📞 ${cust.phone || '-'}\n`;
                message += `   📦 ${cust.package_name || 'N/A'}\n`;
                message += `   💰 Rp ${(cust.monthly_fee || 0).toLocaleString('id-ID')}\n\n`;
            });
            
            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('[TelegramAdmin] CustomerSearch error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    /**
     * Handle /offline command
     */
    private async handleOfflineCustomers(msg: TelegramBot.Message, area?: string): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user) {
                await this.sendMessage(chatId, '❌ Anda belum terdaftar.');
                return;
            }
            
            let query = `
                SELECT 
                    c.customer_id,
                    c.name,
                    c.area,
                    c.phone,
                    si.start_time,
                    TIMESTAMPDIFF(MINUTE, si.start_time, NOW()) as duration_minutes
                FROM sla_incidents si
                JOIN customers c ON si.customer_id = c.id
                WHERE si.status = 'ongoing'
            `;
            
            const params: any[] = [];
            
            if (area) {
                query += ` AND c.area = ?`;
                params.push(area);
            } else if (user.role === 'teknisi' && user.area_coverage.length > 0) {
                query += ` AND c.area IN (?)`;
                params.push(user.area_coverage);
            }
            
            query += ` ORDER BY duration_minutes DESC LIMIT 15`;
            
            const [customers] = await pool.query<RowDataPacket[]>(query, params);
            
            if (customers.length === 0) {
                await this.sendMessage(chatId, '✅ Tidak ada customer yang offline saat ini.');
                return;
            }
            
            let message = `🔴 *Customer Offline (${customers.length})*\n\n`;
            
            customers.forEach((cust: any, index: number) => {
                const urgentIcon = cust.duration_minutes > 60 ? '🚨' : '⚠️';
                
                message += `${index + 1}. ${urgentIcon} *${cust.name}*\n`;
                message += `   ID: ${cust.customer_id} | 📍 ${cust.area || 'N/A'}\n`;
                message += `   ⏱️ ${cust.duration_minutes} menit\n`;
                message += `   📞 ${cust.phone || '-'}\n\n`;
            });
            
            message += `_Update: ${new Date().toLocaleString('id-ID')}_`;
            
            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('[TelegramAdmin] OfflineCustomers error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    /**
     * Handle /stats command
     */
    private async handleStats(msg: TelegramBot.Message): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                await this.sendMessage(chatId, '❌ Perintah ini hanya untuk admin.');
                return;
            }
            
            // Get today's stats
            const [stats] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    (SELECT COUNT(*) FROM customers WHERE status = 'active') as total_active_customers,
                    (SELECT COUNT(*) FROM sla_incidents WHERE status = 'ongoing') as total_incidents,
                    (SELECT COUNT(*) FROM invoices WHERE status = 'unpaid' 
                        AND due_date < CURDATE()) as total_overdue_invoices,
                    (SELECT COUNT(*) FROM payments WHERE DATE(payment_date) = CURDATE()) as payments_today,
                    (SELECT COALESCE(SUM(total_amount), 0) FROM payments 
                        WHERE DATE(payment_date) = CURDATE()) as revenue_today
            `);
            
            const data = stats[0];
            
            let message = 
                `📊 *Statistik Hari Ini*\n` +
                `${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
                `👥 Customer Aktif: *${data.total_active_customers}*\n` +
                `🔴 Incident Aktif: *${data.total_incidents}*\n` +
                `⚠️ Tagihan Overdue: *${data.total_overdue_invoices}*\n` +
                `💰 Pembayaran Hari Ini: *${data.payments_today}*\n` +
                `💵 Revenue: *Rp ${parseInt(data.revenue_today).toLocaleString('id-ID')}*\n\n` +
                `_Update: ${new Date().toLocaleTimeString('id-ID')}_`;
            
            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('[TelegramAdmin] Stats error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    /**
     * Handle /invoice command
     */
    private async handleInvoice(msg: TelegramBot.Message, customerId: string): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user) {
                await this.sendMessage(chatId, '❌ Anda belum terdaftar.');
                return;
            }
            
            if (!customerId) {
                await this.sendMessage(chatId, '❌ Format: /invoice <customer_id>');
                return;
            }
            
            const [invoices] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.total_amount,
                    i.status,
                    i.due_date,
                    i.created_at,
                    c.name as customer_name
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE c.customer_id = ?
                ORDER BY i.created_at DESC
                LIMIT 5
            `, [customerId]);
            
            if (invoices.length === 0) {
                await this.sendMessage(chatId, '❌ Tidak ada tagihan untuk customer ini.');
                return;
            }
            
            const customer = invoices[0].customer_name;
            let message = `💰 *Tagihan ${customer}*\n\n`;
            
            invoices.forEach((inv: any, index: number) => {
                const statusIcon = 
                    inv.status === 'paid' ? '✅' :
                    inv.status === 'partial' ? '⚠️' : '⏳';
                
                message += `${index + 1}. ${statusIcon} ${inv.invoice_number}\n`;
                message += `   Rp ${parseInt(inv.total_amount).toLocaleString('id-ID')}\n`;
                message += `   Status: ${inv.status}\n`;
                message += `   Jatuh tempo: ${new Date(inv.due_date).toLocaleDateString('id-ID')}\n\n`;
            });
            
            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('[TelegramAdmin] Invoice error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    /**
     * Handle /payment command
     */
    private async handlePayment(msg: TelegramBot.Message, customerId: string): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user) {
                await this.sendMessage(chatId, '❌ Anda belum terdaftar.');
                return;
            }
            
            if (!customerId) {
                await this.sendMessage(chatId, '❌ Format: /payment <customer_id>');
                return;
            }
            
            const [payments] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    p.id,
                    p.payment_date,
                    p.total_amount,
                    p.payment_method,
                    i.invoice_number,
                    c.name as customer_name
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN customers c ON i.customer_id = c.id
                WHERE c.customer_id = ?
                ORDER BY p.payment_date DESC
                LIMIT 5
            `, [customerId]);
            
            if (payments.length === 0) {
                await this.sendMessage(chatId, '❌ Tidak ada riwayat pembayaran untuk customer ini.');
                return;
            }
            
            const customer = payments[0].customer_name;
            let message = `💳 *Riwayat Pembayaran ${customer}*\n\n`;
            
            payments.forEach((pay: any, index: number) => {
                message += `${index + 1}. ${pay.invoice_number}\n`;
                message += `   💰 Rp ${parseInt(pay.total_amount).toLocaleString('id-ID')}\n`;
                message += `   📅 ${new Date(pay.payment_date).toLocaleDateString('id-ID')}\n`;
                message += `   💳 ${pay.payment_method}\n\n`;
            });
            
            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('[TelegramAdmin] Payment error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    /**
     * Handle /areas command
     */
    private async handleAreas(msg: TelegramBot.Message): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user) {
                await this.sendMessage(chatId, '❌ Anda belum terdaftar.');
                return;
            }
            
            const [areas] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    area,
                    COUNT(*) as total_customers,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_customers
                FROM customers
                WHERE area IS NOT NULL AND area != ''
                GROUP BY area
                ORDER BY total_customers DESC
            `);
            
            if (areas.length === 0) {
                await this.sendMessage(chatId, '❌ Tidak ada data area.');
                return;
            }
            
            let message = `📍 *Daftar Area*\n\n`;
            
            areas.forEach((area: any, index: number) => {
                message += `${index + 1}. *${area.area}*\n`;
                message += `   👥 ${area.active_customers}/${area.total_customers} customer aktif\n\n`;
            });
            
            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('[TelegramAdmin] Areas error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    /**
     * Handle /performance command
     */
    private async handlePerformance(msg: TelegramBot.Message, period?: string): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
                await this.sendMessage(chatId, '❌ Perintah ini hanya untuk admin.');
                return;
            }
            
            const [performance] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    tu.first_name,
                    tu.last_name,
                    JSON_EXTRACT(tu.area_coverage, '$') as areas,
                    COUNT(DISTINCT tia.id) as total_assignments,
                    COUNT(DISTINCT CASE WHEN tia.status = 'completed' THEN tia.id END) as completed,
                    AVG(TIMESTAMPDIFF(MINUTE, tia.assigned_at, tia.completed_at)) as avg_time_minutes
                FROM telegram_users tu
                LEFT JOIN telegram_incident_assignments tia ON tu.id = tia.technician_user_id
                WHERE tu.role = 'teknisi' AND tu.is_active = 1
                GROUP BY tu.id
                ORDER BY completed DESC
            `);
            
            if (performance.length === 0) {
                await this.sendMessage(chatId, '❌ Tidak ada data performa.');
                return;
            }
            
            let message = `📈 *Performa Teknisi*\n\n`;
            
            performance.forEach((tech: any, index: number) => {
                const name = `${tech.first_name}${tech.last_name ? ' ' + tech.last_name : ''}`;
                const avgTime = tech.avg_time_minutes ? Math.round(tech.avg_time_minutes) : 0;
                
                message += `${index + 1}. *${name}*\n`;
                message += `   ✅ ${tech.completed}/${tech.total_assignments} selesai\n`;
                message += `   ⏱️ Rata-rata: ${avgTime} menit\n\n`;
            });
            
            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('[TelegramAdmin] Performance error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    /**
     * Handle /settings command
     */
    private async handleSettings(msg: TelegramBot.Message): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const user = await this.getUser(chatId);
            
            if (!user) {
                await this.sendMessage(chatId, '❌ Anda belum terdaftar.');
                return;
            }
            
            const notifStatus = user.notification_enabled ? '🔔 Aktif' : '🔕 Nonaktif';
            const buttonText = user.notification_enabled ? '🔕 Matikan Notifikasi' : '🔔 Aktifkan Notifikasi';
            
            const message = 
                `⚙️ *Pengaturan Akun*\n\n` +
                `Notifikasi: ${notifStatus}\n\n` +
                `Klik tombol di bawah untuk mengubah pengaturan.`;
            
            const keyboard = {
                inline_keyboard: [[
                    { text: buttonText, callback_data: 'toggle_notif' }
                ]]
            };
            
            await this.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error('[TelegramAdmin] Settings error:', error);
            await this.sendMessage(chatId, '❌ Terjadi kesalahan.');
        }
    }
    
    // ==========================================
    // CALLBACK HANDLERS
    // ==========================================
    
    /**
     * Handle assign incident callback
     */
    private async handleAssignIncident(chatId: number, callbackData: string): Promise<void> {
        const incidentId = parseInt(callbackData.replace('assign_', ''));
        
        const user = await this.getUser(chatId);
        if (!user) return;
        
        try {
            // Check if already assigned
            const [existing] = await pool.query<RowDataPacket[]>(`
                SELECT id FROM telegram_incident_assignments
                WHERE incident_id = ? AND status IN ('assigned', 'acknowledged', 'working')
            `, [incidentId]);
            
            if (existing.length > 0) {
                await this.sendMessage(chatId, '⚠️ Incident ini sudah di-assign.');
                return;
            }
            
            // Assign incident
            await pool.query(`
                INSERT INTO telegram_incident_assignments (
                    incident_id, technician_user_id, assignment_type, status, assigned_at
                ) VALUES (?, ?, 'self', 'assigned', NOW())
            `, [incidentId, user.id]);
            
            // Update incident
            await pool.query(`
                UPDATE sla_incidents
                SET technician_id = ?
                WHERE id = ?
            `, [user.id, incidentId]);
            
            await this.sendMessage(chatId, '✅ Incident berhasil di-assign ke Anda. Gunakan /mytickets untuk melihat.');
            
            await this.logChatMessage(chatId, 'callback', `assign_${incidentId}`, 'Incident assigned', true);
            
        } catch (error) {
            console.error('[TelegramAdmin] Assign incident error:', error);
            await this.sendMessage(chatId, '❌ Gagal assign incident.');
        }
    }
    
    /**
     * Handle acknowledge incident callback
     */
    private async handleAcknowledgeIncident(chatId: number, callbackData: string): Promise<void> {
        const assignmentId = parseInt(callbackData.replace('ack_', ''));
        
        try {
            await pool.query(`
                UPDATE telegram_incident_assignments
                SET status = 'acknowledged', acknowledged_at = NOW()
                WHERE id = ? AND status = 'assigned'
            `, [assignmentId]);
            
            await this.sendMessage(chatId, '✅ Incident acknowledged. Segera tindak lanjut!');
            
        } catch (error) {
            console.error('[TelegramAdmin] Acknowledge error:', error);
            await this.sendMessage(chatId, '❌ Gagal acknowledge incident.');
        }
    }
    
    /**
     * Handle complete incident callback
     */
    private async handleCompleteIncident(chatId: number, callbackData: string): Promise<void> {
        const assignmentId = parseInt(callbackData.replace('complete_', ''));
        
        try {
            // Update assignment
            await pool.query(`
                UPDATE telegram_incident_assignments
                SET status = 'completed', completed_at = NOW()
                WHERE id = ?
            `, [assignmentId]);
            
            // Get incident info
            const [assignment] = await pool.query<RowDataPacket[]>(`
                SELECT incident_id FROM telegram_incident_assignments WHERE id = ?
            `, [assignmentId]);
            
            if (assignment.length > 0) {
                // Update incident
                await pool.query(`
                    UPDATE sla_incidents
                    SET status = 'resolved', end_time = NOW(), resolved_at = NOW()
                    WHERE id = ?
                `, [assignment[0].incident_id]);
            }
            
            await this.sendMessage(chatId, '✅ Incident ditandai sebagai selesai. Terima kasih!');
            
        } catch (error) {
            console.error('[TelegramAdmin] Complete incident error:', error);
            await this.sendMessage(chatId, '❌ Gagal menyelesaikan incident.');
        }
    }
    
    /**
     * Handle toggle notifications callback
     */
    private async handleToggleNotifications(chatId: number): Promise<void> {
        try {
            const user = await this.getUser(chatId);
            if (!user) return;
            
            const newStatus = !user.notification_enabled;
            
            await pool.query(`
                UPDATE telegram_users
                SET notification_enabled = ?
                WHERE id = ?
            `, [newStatus, user.id]);
            
            const statusText = newStatus ? '🔔 diaktifkan' : '🔕 dinonaktifkan';
            await this.sendMessage(chatId, `✅ Notifikasi telah ${statusText}.`);
            
        } catch (error) {
            console.error('[TelegramAdmin] Toggle notifications error:', error);
            await this.sendMessage(chatId, '❌ Gagal mengubah pengaturan.');
        }
    }
    
    /**
     * Handle quick reply callback
     */
    private async handleQuickReply(chatId: number, callbackData: string): Promise<void> {
        const keyword = callbackData.replace('quick_', '');
        
        try {
            const [replies] = await pool.query<RowDataPacket[]>(`
                SELECT reply_content FROM telegram_quick_replies
                WHERE keyword = ? AND is_active = 1
            `, [keyword]);
            
            if (replies.length > 0) {
                await this.sendMessage(chatId, replies[0].reply_content);
                
                // Update usage count
                await pool.query(`
                    UPDATE telegram_quick_replies
                    SET usage_count = usage_count + 1
                    WHERE keyword = ?
                `, [keyword]);
            }
            
        } catch (error) {
            console.error('[TelegramAdmin] Quick reply error:', error);
        }
    }
    
    // ==========================================
    // NOTIFICATION SYSTEM
    // ==========================================
    
    /**
     * Send notification to specific users
     */
    async sendNotification(payload: NotificationPayload): Promise<{sent: number, failed: number}> {
        if (!this.bot || !this.isInitialized) {
            console.warn('[TelegramAdmin] Bot not initialized');
            return { sent: 0, failed: 0 };
        }
        
        try {
            // Create notification record
            const [result] = await pool.query<ResultSetHeader>(`
                INSERT INTO telegram_notifications (
                    notification_type, priority, title, message,
                    target_role, target_area, customer_id, metadata, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `, [
                payload.type,
                payload.priority,
                payload.title,
                payload.message,
                payload.targetRole || 'all',
                payload.targetArea || null,
                payload.customerId || null,
                JSON.stringify(payload.metadata || {})
            ]);
            
            const notificationId = result.insertId;
            
            // Get recipients
            let query = `
                SELECT id, telegram_chat_id, first_name
                FROM telegram_users
                WHERE is_active = 1 AND notification_enabled = 1
            `;
            
            const params: any[] = [];
            
            if (payload.targetRole && payload.targetRole !== 'all') {
                query += ` AND role = ?`;
                params.push(payload.targetRole);
                
                if (payload.targetArea && payload.targetRole === 'teknisi') {
                    query += ` AND JSON_CONTAINS(area_coverage, ?)`;
                    params.push(JSON.stringify(payload.targetArea));
                }
            }
            
            const [recipients] = await pool.query<RowDataPacket[]>(query, params);
            
            let sentCount = 0;
            let failedCount = 0;
            
            // Send to each recipient
            for (const recipient of recipients) {
                try {
                    const emoji = this.getPriorityEmoji(payload.priority);
                    const message = `${emoji} *${payload.title}*\n\n${payload.message}`;
                    
                    await this.bot.sendMessage(recipient.telegram_chat_id, message, {
                        parse_mode: 'Markdown'
                    });
                    
                    // Log recipient
                    await pool.query(`
                        INSERT INTO telegram_notification_recipients (
                            notification_id, user_id, telegram_chat_id, status, sent_at
                        ) VALUES (?, ?, ?, 'sent', NOW())
                    `, [notificationId, recipient.id, recipient.telegram_chat_id]);
                    
                    sentCount++;
                    
                } catch (error: any) {
                    console.error(`[TelegramAdmin] Failed to send to ${recipient.telegram_chat_id}:`, error.message);
                    
                    await pool.query(`
                        INSERT INTO telegram_notification_recipients (
                            notification_id, user_id, telegram_chat_id, status, error_message
                        ) VALUES (?, ?, ?, 'failed', ?)
                    `, [notificationId, recipient.id, recipient.telegram_chat_id, error.message]);
                    
                    failedCount++;
                }
            }
            
            // Update notification status
            await pool.query(`
                UPDATE telegram_notifications
                SET status = 'sent', sent_count = ?, failed_count = ?, sent_at = NOW()
                WHERE id = ?
            `, [sentCount, failedCount, notificationId]);
            
            console.log(`[TelegramAdmin] Notification sent: ${sentCount} success, ${failedCount} failed`);
            
            return { sent: sentCount, failed: failedCount };
            
        } catch (error) {
            console.error('[TelegramAdmin] Send notification error:', error);
            return { sent: 0, failed: 0 };
        }
    }
    
    /**
     * Send downtime alert to teknisi
     */
    async sendDowntimeAlert(incident: {
        incident_id: number;
        customer_id: number;
        customer_name: string;
        area: string;
        duration_minutes: number;
        phone: string;
    }): Promise<void> {
        const message = 
            `🚨 *CUSTOMER OFFLINE*\n\n` +
            `👤 ${incident.customer_name}\n` +
            `📍 Area: ${incident.area}\n` +
            `⏱️ Duration: ${incident.duration_minutes} menit\n` +
            `📞 ${incident.phone || 'Tidak ada'}\n\n` +
            `Segera tindak lanjut!`;
        
        const keyboard = {
            inline_keyboard: [[
                { text: '👷 Ambil Tugas', callback_data: `assign_${incident.incident_id}` }
            ]]
        };
        
        // Send to teknisi in that area
        const [teknisi] = await pool.query<RowDataPacket[]>(`
            SELECT telegram_chat_id
            FROM telegram_users
            WHERE is_active = 1
                AND notification_enabled = 1
                AND role = 'teknisi'
                AND JSON_CONTAINS(area_coverage, ?)
        `, [JSON.stringify(incident.area)]);
        
        for (const tek of teknisi) {
            try {
                await this.bot?.sendMessage(tek.telegram_chat_id, message, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } catch (error) {
                console.error('[TelegramAdmin] Failed to send downtime alert:', error);
            }
        }
        
        // Also send to admin without button
        await this.sendNotification({
            type: 'downtime',
            priority: 'high',
            title: 'Customer Offline',
            message: `${incident.customer_name} (${incident.area}) offline ${incident.duration_minutes} menit`,
            targetRole: 'admin',
            customerId: incident.customer_id
        });
    }
    
    /**
     * Create invite code for new user
     */
    async createInviteCode(
        role: 'admin' | 'teknisi' | 'kasir' | 'superadmin',
        areaCoverage: string[],
        expiryDays: number = 7
    ): Promise<string> {
        const inviteCode = `${role.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);
        
        await pool.query(`
            INSERT INTO telegram_users (
                role, area_coverage, invite_code, invite_expires_at, is_active
            ) VALUES (?, ?, ?, ?, 0)
        `, [role, JSON.stringify(areaCoverage), inviteCode, expiresAt]);
        
        return inviteCode;
    }
    
    /**
     * Get bot statistics
     */
    async getBotStatistics(dateFrom?: Date, dateTo?: Date): Promise<any> {
        const from = dateFrom || new Date();
        const to = dateTo || new Date();
        
        const [result] = await pool.query<RowDataPacket[]>(`
            CALL sp_get_telegram_bot_stats(?, ?)
        `, [from, to]);
        
        return result[0] || {};
    }
    
    // ==========================================
    // HELPER METHODS
    // ==========================================
    
    /**
     * Get user by chat ID
     */
    private async getUser(chatId: number): Promise<TelegramUser | null> {
        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT 
                id,
                telegram_chat_id,
                telegram_username,
                first_name,
                last_name,
                role,
                area_coverage,
                is_active,
                notification_enabled
            FROM telegram_users
            WHERE telegram_chat_id = ? AND is_active = 1
        `, [chatId.toString()]);
        
        if (rows.length === 0) return null;
        
        const user = rows[0];
        return {
            ...user,
            area_coverage: JSON.parse(user.area_coverage || '[]')
        };
    }
    
    /**
     * Send message helper
     */
    private async sendMessage(chatId: number, text: string, options?: any): Promise<void> {
        if (!this.bot) return;
        
        try {
            await this.bot.sendMessage(chatId, text, options);
        } catch (error) {
            console.error('[TelegramAdmin] Send message error:', error);
        }
    }
    
    /**
     * Log chat message
     */
    private async logChatMessage(
        chatId: number | string,
        messageType: string,
        content: string,
        response: string,
        isSuccess: boolean,
        error?: string
    ): Promise<void> {
        try {
            const [user] = await pool.query<RowDataPacket[]>(`
                SELECT id FROM telegram_users WHERE telegram_chat_id = ?
            `, [chatId.toString()]);
            
            await pool.query(`
                INSERT INTO telegram_chat_logs (
                    user_id, telegram_chat_id, message_type, message_content,
                    bot_response, is_success, error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                user.length > 0 ? user[0].id : null,
                chatId.toString(),
                messageType,
                content,
                response,
                isSuccess,
                error || null
            ]);
        } catch (error) {
            console.error('[TelegramAdmin] Log error:', error);
        }
    }
    
    /**
     * Log system message
     */
    private async logSystemMessage(message: string): Promise<void> {
        try {
            await pool.query(`
                INSERT INTO telegram_chat_logs (
                    telegram_chat_id, message_type, message_content, is_success
                ) VALUES ('system', 'system', ?, 1)
            `, [message]);
        } catch (error) {
            console.error('[TelegramAdmin] Log system error:', error);
        }
    }
    
    /**
     * Get priority emoji
     */
    private getPriorityEmoji(priority: string): string {
        switch (priority) {
            case 'critical': return '🚨';
            case 'high': return '🔴';
            case 'medium': return '🟡';
            case 'low': return '🔵';
            default: return '📢';
        }
    }
    
    /**
     * Get bot info
     */
    getBotInfo(): { isInitialized: boolean; botToken: string } {
        return {
            isInitialized: this.isInitialized,
            botToken: this.botToken ? '***' + this.botToken.slice(-8) : 'Not configured'
        };
    }
    
    /**
     * Stop bot polling
     */
    public stopBot(): void {
        try {
            if (this.bot) {
                console.log('[TelegramAdmin] Stopping bot polling...');
                this.bot.stopPolling();
                this.bot = null;
                this.isInitialized = false;
                console.log('[TelegramAdmin] ✅ Bot stopped successfully');
            }
        } catch (error) {
            console.error('[TelegramAdmin] Error stopping bot:', error);
        }
    }
    
    /**
     * Reinitialize bot with new token
     */
    public reinitializeBot(newToken: string): void {
        try {
            console.log('[TelegramAdmin] 🔄 Reinitializing bot with new token...');
            
            // Stop current bot if running
            this.stopBot();
            
            // Update token
            this.botToken = newToken;
            process.env.TELEGRAM_BOT_TOKEN = newToken;
            
            // Check if token is valid
            const isValidToken = this.botToken && 
                                this.botToken.length > 10 && 
                                !this.botToken.includes('your_') &&
                                !this.botToken.includes('YOUR_') &&
                                this.botToken !== 'your_telegram_bot_token_here';
            
            if (isValidToken) {
                // Initialize with new token
                this.initializeBot();
                console.log('[TelegramAdmin] ✅ Bot reinitialized successfully');
            } else {
                console.warn('[TelegramAdmin] ⚠️  Invalid token provided, bot not started');
            }
        } catch (error) {
            console.error('[TelegramAdmin] ❌ Error reinitializing bot:', error);
        }
    }
}

// Export singleton instance
export default new TelegramAdminService();

