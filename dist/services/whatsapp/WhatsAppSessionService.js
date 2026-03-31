"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppSessionService = void 0;
const pool_1 = require("../../db/pool");
class WhatsAppSessionService {
    /**
     * Get session from database
     */
    static async getSession(phone) {
        try {
            // Normalize phone (remove + and non-digits)
            const cleanPhone = phone.replace(/\D/g, '');
            const [rows] = await pool_1.databasePool.query('SELECT * FROM whatsapp_sessions WHERE phone_number = ?', [cleanPhone]);
            if (rows.length === 0)
                return null;
            const row = rows[0];
            return {
                phone: row.phone_number,
                step: row.current_step,
                data: typeof row.temp_data === 'string' ? JSON.parse(row.temp_data) : row.temp_data,
                lastInteraction: new Date(row.updated_at).getTime()
            };
        }
        catch (error) {
            console.error('[WhatsAppSessionService] Error getting session:', error);
            return null;
        }
    }
    /**
     * Set/Update session in database
     */
    static async setSession(phone, data) {
        try {
            const cleanPhone = phone.replace(/\D/g, '');
            const step = data.step || '';
            const jsonData = JSON.stringify(data.data || {});
            await pool_1.databasePool.query(`INSERT INTO whatsapp_sessions (phone_number, current_step, temp_data, updated_at)
                 VALUES (?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE
                 current_step = VALUES(current_step),
                 temp_data = VALUES(temp_data),
                 updated_at = NOW()`, [cleanPhone, step, jsonData]);
        }
        catch (error) {
            console.error('[WhatsAppSessionService] Error setting session:', error);
        }
    }
    /**
     * Update partial session data
     */
    static async updateSession(phone, updates) {
        try {
            const existing = await this.getSession(phone);
            const newData = {
                ...(existing?.data || {}),
                ...(updates.data || {})
            };
            await this.setSession(phone, {
                step: updates.step || existing?.step || '',
                data: newData
            });
        }
        catch (error) {
            console.error('[WhatsAppSessionService] Error updating session:', error);
        }
    }
    /**
     * Clear session from database
     */
    static async clearSession(phone) {
        try {
            const cleanPhone = phone.replace(/\D/g, '');
            await pool_1.databasePool.query('DELETE FROM whatsapp_sessions WHERE phone_number = ?', [cleanPhone]);
        }
        catch (error) {
            console.error('[WhatsAppSessionService] Error clearing session:', error);
        }
    }
}
exports.WhatsAppSessionService = WhatsAppSessionService;
//# sourceMappingURL=WhatsAppSessionService.js.map