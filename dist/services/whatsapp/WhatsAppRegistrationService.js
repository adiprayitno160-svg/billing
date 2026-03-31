"use strict";
/**
 * WhatsApp Registration Service
 * Handles new customer registration via WhatsApp Bot
 * Creates customer account and generates PPPoE credentials
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppRegistrationService = void 0;
const pool_1 = require("../../db/pool");
const MikrotikService_1 = require("../mikrotik/MikrotikService");
// Store registration sessions in memory (phone -> RegistrationSession)
const registrationSessions = new Map();
class WhatsAppRegistrationService {
    /**
     * Check if phone has an active registration session
     */
    static hasActiveSession(phone) {
        const session = registrationSessions.get(phone);
        if (!session)
            return false;
        // Check if session expired
        if (new Date() > session.expiresAt) {
            registrationSessions.delete(phone);
            return false;
        }
        return true;
    }
    /**
     * Get current registration session
     */
    static getSession(phone) {
        const session = registrationSessions.get(phone);
        if (!session)
            return null;
        // Check if session expired
        if (new Date() > session.expiresAt) {
            registrationSessions.delete(phone);
            return null;
        }
        return session;
    }
    /**
     * Start new registration session
     */
    static startRegistration(phone) {
        const session = {
            phone,
            step: 'name',
            data: {},
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.SESSION_TIMEOUT_MS)
        };
        registrationSessions.set(phone, session);
        console.log(`[Registration] Started new session for ${phone}`);
        return session;
    }
    /**
     * Process registration step based on current session state
     */
    static async processStep(phone, input) {
        const session = this.getSession(phone);
        if (!session) {
            // Start new session
            this.startRegistration(phone);
            return this.getWelcomeMessage();
        }
        switch (session.step) {
            case 'name':
                return this.processNameStep(phone, input);
            case 'address':
                return this.processAddressStep(phone, input);
            case 'confirm':
                return this.processConfirmStep(phone, input);
            default:
                return this.getWelcomeMessage();
        }
    }
    /**
     * Process name input
     */
    static processNameStep(phone, input) {
        const name = input.trim();
        if (name.length < 3) {
            return '❌ Nama terlalu pendek. Silakan masukkan nama lengkap Anda (minimal 3 karakter).';
        }
        if (name.length > 100) {
            return '❌ Nama terlalu panjang. Maksimal 100 karakter.';
        }
        const session = registrationSessions.get(phone);
        session.data.name = name;
        session.step = 'address';
        registrationSessions.set(phone, session);
        return `✅ Nama: *${name}*\n\n📍 *LANGKAH 2/3*\nSekarang masukkan *alamat lengkap* Anda:\n\n_Contoh: Jl. Merdeka No. 123, RT 01/RW 02, Kelurahan Sukamaju, Kecamatan Sukabumi_`;
    }
    /**
     * Process address input
     */
    static processAddressStep(phone, input) {
        const address = input.trim();
        if (address.length < 10) {
            return '❌ Alamat terlalu pendek. Silakan masukkan alamat lengkap Anda (minimal 10 karakter).';
        }
        if (address.length > 500) {
            return '❌ Alamat terlalu panjang. Maksimal 500 karakter.';
        }
        const session = registrationSessions.get(phone);
        session.data.address = address;
        session.step = 'confirm';
        registrationSessions.set(phone, session);
        return `📋 *KONFIRMASI DATA PENDAFTARAN*\n\n` +
            `👤 *Nama:* ${session.data.name}\n` +
            `📍 *Alamat:* ${session.data.address}\n` +
            `📱 *No. HP:* ${phone}\n\n` +
            `Apakah data di atas sudah benar?\n` +
            `Balas *YA* untuk melanjutkan atau *TIDAK* untuk mengulang.`;
    }
    /**
     * Process confirmation
     */
    static async processConfirmStep(phone, input) {
        const answer = input.trim().toLowerCase();
        if (answer === 'ya' || answer === 'y' || answer === 'yes' || answer === 'ok') {
            const session = registrationSessions.get(phone);
            try {
                const result = await this.createCustomerAccount(phone, session.data);
                // Clear session
                registrationSessions.delete(phone);
                return `🎉 *PENDAFTARAN BERHASIL!*\n\n` +
                    `👤 *Nama:* ${result.customer.name}\n` +
                    `📱 *Kode Pelanggan:* ${result.customer.customer_code}\n\n` +
                    `📶 *AKUN INTERNET PPPoE*\n` +
                    `👤 *Username:* ${result.pppoe.username}\n` +
                    `🔑 *Password:* ${result.pppoe.password}\n\n` +
                    `⚠️ *PENTING:*\n` +
                    `• Simpan username dan password Anda\n` +
                    `• Hubungi teknisi untuk pemasangan\n` +
                    `• Ubah password setelah terhubung\n\n` +
                    `Ketik */menu* untuk melihat menu utama.`;
            }
            catch (error) {
                console.error('[Registration] Error creating account:', error);
                // Clear session on error
                registrationSessions.delete(phone);
                return `❌ *GAGAL MENDAFTAR*\n\n` +
                    `Maaf, terjadi kesalahan saat memproses pendaftaran Anda.\n` +
                    `Error: ${error.message || 'Unknown error'}\n\n` +
                    `Silakan coba lagi atau hubungi customer service.`;
            }
        }
        else if (answer === 'tidak' || answer === 'no' || answer === 'batal') {
            // Restart registration
            this.startRegistration(phone);
            return `🔄 *Pendaftaran diulang.*\n\n` + this.getWelcomeMessage();
        }
        else {
            return `❓ Mohon balas dengan *YA* atau *TIDAK*.\n\n` +
                `• Balas *YA* untuk melanjutkan pendaftaran\n` +
                `• Balas *TIDAK* untuk mengulang dari awal`;
        }
    }
    /**
     * Create customer account in database and MikroTik
     */
    static async createCustomerAccount(phone, data) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.beginTransaction();
            // Generate customer code
            const customerCode = await this.generateCustomerCode(conn);
            // Generate PPPoE username (based on customer code)
            const pppoeUsername = customerCode.toLowerCase().replace(/-/g, '');
            // Insert customer
            const [result] = await conn.query(`INSERT INTO customers (
                    customer_code, name, phone, address, status, 
                    connection_type, pppoe_username, pppoe_password,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'active', 'pppoe', ?, ?, NOW(), NOW())`, [
                customerCode,
                data.name,
                phone,
                data.address || '',
                pppoeUsername,
                this.DEFAULT_PPPOE_PASSWORD
            ]);
            const customerId = result.insertId;
            // Try to create PPPoE secret in MikroTik
            try {
                const mikrotik = await MikrotikService_1.MikrotikService.getInstance();
                const created = await mikrotik.createPPPoEUser({
                    name: pppoeUsername,
                    password: this.DEFAULT_PPPOE_PASSWORD,
                    profile: this.DEFAULT_PPPOE_PROFILE,
                    comment: `WA Registration: ${data.name} (ID: ${customerId})`
                });
                if (!created) {
                    console.warn(`[Registration] Failed to create PPPoE in MikroTik for ${pppoeUsername}`);
                }
                else {
                    console.log(`[Registration] ✅ PPPoE secret created in MikroTik: ${pppoeUsername}`);
                }
            }
            catch (mikrotikError) {
                console.error('[Registration] MikroTik error (non-fatal):', mikrotikError);
                // Continue - customer is created, MikroTik can be synced later
            }
            await conn.commit();
            console.log(`[Registration] ✅ Customer created: ${customerCode} (ID: ${customerId})`);
            return {
                customer: {
                    id: customerId,
                    customer_code: customerCode,
                    name: data.name,
                    phone,
                    address: data.address
                },
                pppoe: {
                    username: pppoeUsername,
                    password: this.DEFAULT_PPPOE_PASSWORD
                }
            };
        }
        catch (error) {
            await conn.rollback();
            throw error;
        }
        finally {
            conn.release();
        }
    }
    /**
     * Generate unique customer code
     */
    static async generateCustomerCode(conn) {
        const prefix = 'WA';
        const date = new Date();
        const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
        // Get latest sequence for this month
        const [rows] = await conn.query(`SELECT customer_code FROM customers 
             WHERE customer_code LIKE ? 
             ORDER BY id DESC LIMIT 1`, [`${prefix}-${dateStr}-%`]);
        let sequence = 1;
        if (rows.length > 0) {
            const lastCode = rows[0].customer_code;
            const lastSeq = parseInt(lastCode.split('-').pop() || '0', 10);
            sequence = lastSeq + 1;
        }
        return `${prefix}-${dateStr}-${String(sequence).padStart(4, '0')}`;
    }
    /**
     * Get welcome message for new registration
     */
    static getWelcomeMessage() {
        return `🎊 *SELAMAT DATANG!*\n\n` +
            `Anda belum terdaftar sebagai pelanggan kami.\n\n` +
            `Untuk mendaftar, ikuti langkah berikut:\n\n` +
            `📝 *LANGKAH 1/3*\n` +
            `Silakan masukkan *nama lengkap* Anda:\n\n` +
            `_Contoh: Ahmad Susanto_`;
    }
    /**
     * Cancel registration session
     */
    static cancelRegistration(phone) {
        registrationSessions.delete(phone);
        console.log(`[Registration] Session cancelled for ${phone}`);
    }
    /**
     * Clean up expired sessions (call periodically)
     */
    static cleanupExpiredSessions() {
        const now = new Date();
        let cleaned = 0;
        const entries = Array.from(registrationSessions.entries());
        for (const [phone, session] of entries) {
            if (now > session.expiresAt) {
                registrationSessions.delete(phone);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[Registration] Cleaned up ${cleaned} expired sessions`);
        }
    }
}
exports.WhatsAppRegistrationService = WhatsAppRegistrationService;
// Session timeout: 30 minutes
WhatsAppRegistrationService.SESSION_TIMEOUT_MS = 30 * 60 * 1000;
// Default PPPoE password
WhatsAppRegistrationService.DEFAULT_PPPOE_PASSWORD = '12345';
// Default profile for new customers
WhatsAppRegistrationService.DEFAULT_PPPOE_PROFILE = 'default';
// Cleanup expired sessions every 5 minutes
setInterval(() => {
    WhatsAppRegistrationService.cleanupExpiredSessions();
}, 5 * 60 * 1000);
//# sourceMappingURL=WhatsAppRegistrationService.js.map