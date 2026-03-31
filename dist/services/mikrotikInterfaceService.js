"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMikrotikInterfaces = getMikrotikInterfaces;
const pool_1 = require("../db/pool");
const node_routeros_1 = require("node-routeros");
async function getMikrotikInterfaces() {
    const conn = await pool_1.databasePool.getConnection();
    try {
        const [rows] = await conn.execute('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
        const settings = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        if (!settings) {
            console.error("No MikroTik config found when fetching interfaces.");
            return [];
        }
        const api = new node_routeros_1.RouterOSAPI({
            host: settings.host,
            port: settings.port,
            user: settings.username,
            password: settings.password,
            timeout: 5000 // Short timeout
        });
        try {
            await api.connect();
            const interfaces = await api.write('/interface/print');
            await api.close();
            return interfaces.map((i) => i.name).sort();
        }
        catch (err) {
            console.error("Failed to fetch interfaces from MikroTik:", err);
            return [];
        }
    }
    catch (dbErr) {
        console.error("DB Error fetching interfaces:", dbErr);
        return [];
    }
    finally {
        conn.release();
    }
}
//# sourceMappingURL=mikrotikInterfaceService.js.map