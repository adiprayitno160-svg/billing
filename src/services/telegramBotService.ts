/**
 * Telegram Bot Service - Internal Alert System
 * Handles Telegram bot for staff notifications and commands
 */

import TelegramBot from '../stubs/node-telegram-bot-api';
import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface TelegramUser {
    id: number;
    telegram_chat_id: string;
    telegram_username: string;
    first_name: string;
    last_name?: string;
    role: 'admin' | 'teknisi' | 'kasir';
    area_coverage: string[];
    is_active: boolean;
}

interface AlertMessage {
    alert_type: 'critical' | 'warning' | 'info';
    title: string;
    body: string;
    metadata?: any;
}

export class TelegramBotService {
    private bot: TelegramBot | null = null;
    private readonly botToken: string;
    private isInitialized: boolean = false;

    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';

        // Check if token is valid (not empty and not placeholder)
        const isValidToken = this.botToken &&
            this.botToken.length > 10 &&
            !this.botToken.includes('your_') &&
            !this.botToken.includes('YOUR_') &&
            this.botToken !== 'your_telegram_bot_token_here';

        if (isValidToken) {
            // this.initializeBot(); // DISABLED to clear logs per user request
            console.log('[TelegramBot] ⚠️ Telegram Bot disabled by code (see TelegramBotService.ts)');
        } else {
            console.warn('[TelegramBot] ⚠️ Bot token not configured or invalid.');
            console.warn('[TelegramBot] 📝 Silakan atur token melalui: Settings > Telegram');
            console.warn('[TelegramBot] 🔗 Cara mendapatkan token: https://t.me/BotFather');
        }
    }

    /**
     * Initialize Telegram bot
     */
    private initializeBot(): void {
        try {
            this.bot = new TelegramBot(this.botToken, { polling: true });
            this.setupCommands();
            this.isInitialized = true;
            console.log('[TelegramBot] Bot initialized successfully');
        } catch (error) {
            console.error('[TelegramBot] Failed to initialize bot:', error);
        }
    }

    /**
     * Setup bot commands
     */
    private setupCommands(): void {
        if (!this.bot) return;

        // /start command
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const username = msg.from?.username || '';

            await this.bot?.sendMessage(chatId,
                `👋 Selamat datang di ISP Monitoring Bot!\n\n` +
                `Untuk mendaftar sebagai staff, gunakan:\n` +
                `/register <kode_registrasi>\n\n` +
                `Jika Anda sudah terdaftar, Anda akan menerima alert otomatis.`
            );
        });

        // /register command
        this.bot.onText(/\/register (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const inviteCode = match?.[1];
            const username = msg.from?.username || '';
            const firstName = msg.from?.first_name || '';
            const lastName = msg.from?.last_name || '';

            if (!inviteCode) {
                await this.bot?.sendMessage(chatId, '❌ Kode registrasi tidak valid.');
                return;
            }

            try {
                // Check if invite code exists
                const [rows] = await pool.query<RowDataPacket[]>(`
                    SELECT id, role, area_coverage, invite_expires_at
                    FROM telegram_users
                    WHERE invite_code = ?
                        AND is_active = 0
                `, [inviteCode]);

                if (rows.length === 0) {
                    await this.bot?.sendMessage(chatId, '❌ Kode registrasi tidak ditemukan atau sudah digunakan.');
                    return;
                }

                const user = rows[0];

                // Check expiration
                if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
                    await this.bot?.sendMessage(chatId, '❌ Kode registrasi sudah kadaluarsa.');
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

                await this.bot?.sendMessage(chatId,
                    `✅ Registrasi berhasil!\n\n` +
                    `👤 Role: ${(user as any).role}\n` +
                    `📍 Area: ${areaCoverage.join(', ') || 'Semua area'}\n\n` +
                    `Anda akan menerima alert otomatis untuk area Anda.`
                );

                console.log(`[TelegramBot] User registered: ${username} (${(user as any).role})`);

            } catch (error) {
                console.error('[TelegramBot] Registration error:', error);
                await this.bot?.sendMessage(chatId, '❌ Terjadi kesalahan saat registrasi.');
            }
        });

        // /status command
        this.bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;

            try {
                const [rows] = await pool.query<RowDataPacket[]>(`
                    SELECT role, area_coverage, registered_at
                    FROM telegram_users
                    WHERE telegram_chat_id = ?
                        AND is_active = 1
                `, [chatId.toString()]);

                if (rows.length === 0) {
                    await this.bot?.sendMessage(chatId, '❌ Anda belum terdaftar. Gunakan /register untuk mendaftar.');
                    return;
                }

                const user = rows[0];
                const areaCoverage = JSON.parse(user.area_coverage || '[]');

                // Get assigned incidents
                const [incidents] = await pool.query<RowDataPacket[]>(`
                    SELECT COUNT(*) AS count
                    FROM sla_incidents si
                    JOIN telegram_users tu ON si.technician_id = tu.id
                    WHERE tu.telegram_chat_id = ?
                        AND si.status = 'ongoing'
                `, [chatId.toString()]);

                await this.bot?.sendMessage(chatId,
                    `📊 Status Anda\n\n` +
                    `👤 Role: ${(user as any).role}\n` +
                    `📍 Area: ${areaCoverage.join(', ') || 'Semua area'}\n` +
                    `🔧 Incident aktif: ${incidents[0].count}\n` +
                    `📅 Terdaftar: ${new Date((user as any).registered_at).toLocaleDateString('id-ID')}`
                );

            } catch (error) {
                console.error('[TelegramBot] Status error:', error);
                await this.bot?.sendMessage(chatId, '❌ Terjadi kesalahan.');
            }
        });

        // /help command
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id;

            await this.bot?.sendMessage(chatId,
                `📖 Perintah yang tersedia:\n\n` +
                `/start - Memulai bot\n` +
                `/register <kode> - Registrasi dengan kode undangan\n` +
                `/status - Lihat status Anda\n` +
                `/incidents - Lihat incident aktif\n` +
                `/help - Bantuan\n\n` +
                `Anda akan menerima alert otomatis untuk area Anda.`
            );
        });

        // /incidents command
        this.bot.onText(/\/incidents/, async (msg) => {
            const chatId = msg.chat.id;

            try {
                const [user] = await pool.query<RowDataPacket[]>(`
                    SELECT id, role, area_coverage
                    FROM telegram_users
                    WHERE telegram_chat_id = ?
                        AND is_active = 1
                `, [chatId.toString()]);

                if (user.length === 0) {
                    await this.bot?.sendMessage(chatId, '❌ Anda belum terdaftar.');
                    return;
                }

                const areaCoverage = JSON.parse((user[0] as any).area_coverage || '[]');

                // Get active incidents for user's area
                let query = `
                    SELECT 
                        si.id,
                        c.name AS customer_name,
                        c.area,
                        si.start_time,
                        si.duration_minutes
                    FROM sla_incidents si
                    JOIN customers c ON si.customer_id = c.id
                    WHERE si.status = 'ongoing'
                `;

                const params: any[] = [];

                // Filter by area for teknisi
                if ((user[0] as any).role === 'teknisi' && areaCoverage.length > 0) {
                    query += ` AND c.area IN (?)`;
                    params.push(areaCoverage);
                }

                query += ` ORDER BY si.duration_minutes DESC LIMIT 10`;

                const [incidents] = await pool.query<RowDataPacket[]>(query, params);

                if (incidents.length === 0) {
                    await this.bot?.sendMessage(chatId, '✅ Tidak ada incident aktif.');
                    return;
                }

                let message = `🔴 Incident Aktif (${incidents.length}):\n\n`;

                incidents.forEach((inc: any, index: number) => {
                    message += `${index + 1}. ${inc.customer_name}\n`;
                    message += `   📍 ${inc.area || 'N/A'}\n`;
                    message += `   ⏱️ ${inc.duration_minutes} menit\n\n`;
                });

                await this.bot?.sendMessage(chatId, message);

            } catch (error) {
                console.error('[TelegramBot] Incidents error:', error);
                await this.bot?.sendMessage(chatId, '❌ Terjadi kesalahan.');
            }
        });

        // Handle callback queries (button clicks)
        this.bot.on('callback_query', async (query) => {
            const chatId = query.message?.chat.id;
            const data = query.data;

            if (!chatId || !data) return;

            try {
                if (data.startsWith('assign_')) {
                    const incidentId = parseInt(data.replace('assign_', ''));
                    await this.handleAssignIncident(chatId, incidentId);
                } else if (data.startsWith('resolve_')) {
                    const incidentId = parseInt(data.replace('resolve_', ''));
                    await this.handleResolveIncident(chatId, incidentId);
                }

                await this.bot?.answerCallbackQuery(query.id);

            } catch (error) {
                console.error('[TelegramBot] Callback error:', error);
            }
        });

        console.log('[TelegramBot] Commands registered');
    }

    /**
     * Handle assign incident
     */
    private async handleAssignIncident(chatId: number, incidentId: number): Promise<void> {
        const [user] = await pool.query<RowDataPacket[]>(`
            SELECT id FROM telegram_users
            WHERE telegram_chat_id = ? AND is_active = 1
        `, [chatId.toString()]);

        if (user.length === 0) return;

        await pool.query(`
            UPDATE sla_incidents
            SET technician_id = ?
            WHERE id = ?
        `, [(user[0] as any).id, incidentId]);

        await this.bot?.sendMessage(chatId, '✅ Incident berhasil di-assign ke Anda.');
    }

    /**
     * Handle resolve incident
     */
    private async handleResolveIncident(chatId: number, incidentId: number): Promise<void> {
        await pool.query(`
            UPDATE sla_incidents
            SET 
                status = 'resolved',
                end_time = NOW(),
                resolved_at = NOW()
            WHERE id = ?
        `, [incidentId]);

        await this.bot?.sendMessage(chatId, '✅ Incident ditandai sebagai resolved.');
    }

    /**
     * Send alert to specific user
     */
    async sendAlert(chatId: string, alert: AlertMessage): Promise<boolean> {
        if (!this.bot || !this.isInitialized) {
            console.warn('[TelegramBot] Bot not initialized');
            return false;
        }

        try {
            const emoji = alert.alert_type === 'critical' ? '🔴' :
                alert.alert_type === 'warning' ? '🟡' : '🔵';

            const message = `${emoji} ${alert.title}\n\n${alert.body}`;

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });

            return true;

        } catch (error) {
            console.error(`[TelegramBot] Failed to send alert to ${chatId}:`, error);
            return false;
        }
    }

    /**
     * Send alert with interactive buttons
     */
    async sendInteractiveAlert(
        chatId: string,
        alert: AlertMessage,
        buttons: { text: string, callback_data: string }[]
    ): Promise<boolean> {
        if (!this.bot || !this.isInitialized) return false;

        try {
            const emoji = alert.alert_type === 'critical' ? '🔴' :
                alert.alert_type === 'warning' ? '🟡' : '🔵';

            const message = `${emoji} ${alert.title}\n\n${alert.body}`;

            const keyboard = {
                inline_keyboard: [
                    buttons.map(btn => ({
                        text: btn.text,
                        callback_data: btn.callback_data
                    }))
                ]
            };

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });

            return true;

        } catch (error) {
            console.error('[TelegramBot] Failed to send interactive alert:', error);
            return false;
        }
    }

    /**
     * Send alert to multiple users by role
     */
    async sendAlertByRole(
        role: 'admin' | 'teknisi' | 'kasir',
        alert: AlertMessage,
        area?: string
    ): Promise<number> {
        let query = `
            SELECT telegram_chat_id, area_coverage
            FROM telegram_users
            WHERE is_active = 1
                AND role = ?
        `;

        const params: any[] = [role];

        // Add area filter for teknisi
        if (area && role === 'teknisi') {
            query += ` AND JSON_CONTAINS(area_coverage, ?)`;
            params.push(JSON.stringify(area));
        }

        const [users] = await pool.query<RowDataPacket[]>(query, params);

        let sentCount = 0;

        for (const user of users) {
            const success = await this.sendAlert(user.telegram_chat_id, alert);
            if (success) sentCount++;
        }

        return sentCount;
    }

    /**
     * Send critical downtime alert
     */
    async sendDowntimeAlert(incident: {
        customer_id: number;
        customer_name: string;
        area: string;
        duration_minutes: number;
        service_type: string;
        incident_id: number;
    }): Promise<void> {
        const alert: AlertMessage = {
            alert_type: 'critical',
            title: 'CUSTOMER OFFLINE > 30 MENIT',
            body:
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 Customer: ${incident.customer_name}\n` +
                `📍 Area: ${incident.area}\n` +
                `⏱️ Duration: ${incident.duration_minutes} menit\n` +
                `🔌 Type: ${incident.service_type.toUpperCase()}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Segera tindak lanjut!`,
            metadata: { incident_id: incident.incident_id }
        };

        // Send to admins
        await this.sendAlertByRole('admin', alert);

        // Send to teknisi in that area
        if (incident.area) {
            const buttons = [
                { text: '👷 Assign to Me', callback_data: `assign_${incident.incident_id}` },
                { text: '✅ Mark Resolved', callback_data: `resolve_${incident.incident_id}` }
            ];

            const [teknisi] = await pool.query<RowDataPacket[]>(`
                SELECT telegram_chat_id
                FROM telegram_users
                WHERE is_active = 1
                    AND role = 'teknisi'
                    AND JSON_CONTAINS(area_coverage, ?)
            `, [JSON.stringify(incident.area)]);

            for (const tek of teknisi) {
                await this.sendInteractiveAlert(tek.telegram_chat_id, alert, buttons);
            }
        }
    }

    /**
     * Send SLA breach warning
     */
    async sendSLAWarning(slaData: {
        customer_name: string;
        current_sla: number;
        target_sla: number;
        estimated_discount: number;
    }): Promise<void> {
        const alert: AlertMessage = {
            alert_type: 'warning',
            title: 'SLA BREACH WARNING',
            body:
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 Customer: ${slaData.customer_name}\n` +
                `📊 Current SLA: ${slaData.current_sla.toFixed(2)}%\n` +
                `🎯 Target: ${slaData.target_sla}%\n` +
                `💰 Est. Discount: Rp ${slaData.estimated_discount.toLocaleString('id-ID')}\n` +
                `━━━━━━━━━━━━━━━━━━━━`
        };

        await this.sendAlertByRole('admin', alert);
    }

    /**
     * Create invite code for new user
     */
    async createInviteCode(
        role: 'admin' | 'teknisi' | 'kasir',
        areaCoverage: string[],
        createdBy: number
    ): Promise<string> {
        const inviteCode = `${role.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        await pool.query(`
            INSERT INTO telegram_users (
                role,
                area_coverage,
                invite_code,
                invite_expires_at,
                is_active
            ) VALUES (?, ?, ?, ?, 0)
        `, [role, JSON.stringify(areaCoverage), inviteCode, expiresAt]);

        return inviteCode;
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
}

export default new TelegramBotService();

