"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OltService = void 0;
const pool_1 = require("../../db/pool");
class OltService {
    static async listOlts() {
        try {
            const [rows] = await pool_1.databasePool.query(`
                SELECT * FROM ftth_olt 
                ORDER BY id DESC
            `);
            return rows;
        }
        catch (error) {
            console.error('Error listing OLTs:', error);
            throw error;
        }
    }
    static async getOltById(id) {
        try {
            const [rows] = await pool_1.databasePool.query(`
                SELECT * FROM ftth_olt WHERE id = ?
            `, [id]);
            if (Array.isArray(rows) && rows.length > 0) {
                return rows[0];
            }
            return null;
        }
        catch (error) {
            console.error('Error getting OLT by ID:', error);
            throw error;
        }
    }
}
exports.OltService = OltService;
//# sourceMappingURL=oltService.js.map