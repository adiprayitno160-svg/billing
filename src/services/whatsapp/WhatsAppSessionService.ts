
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export class WhatsAppSessionService {

    // Set Status
    static async setSession(phone: string, step: string, data: any = {}) {
        const jsonData = JSON.stringify(data);
        await databasePool.query(`
            INSERT INTO whatsapp_sessions (phone_number, current_step, temp_data)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE current_step = ?, temp_data = ?
        `, [phone, step, jsonData, step, jsonData]);
    }

    // Get Status
    static async getSession(phone: string): Promise<{ step: string, data: any } | null> {
        const [rows] = await databasePool.query<RowDataPacket[]>(
            `SELECT * FROM whatsapp_sessions WHERE phone_number = ?`,
            [phone]
        );
        if (rows.length === 0) return null;
        return {
            step: rows[0].current_step,
            data: rows[0].temp_data // MySQL driver usually parses JSON automatically or returns obj
        };
    }

    // Clear Status
    static async clearSession(phone: string) {
        await databasePool.query(`DELETE FROM whatsapp_sessions WHERE phone_number = ?`, [phone]);
    }
}
