"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
async function checkTables() {
    try {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.query("SHOW COLUMNS FROM sla_records");
            console.log('sla_records table exists.');
        }
        catch (e) {
            console.log('sla_records table MISSING.');
        }
        try {
            await conn.query("SHOW COLUMNS FROM discounts");
            console.log('discounts table exists.');
        }
        catch (e) {
            console.log('discounts table MISSING.');
        }
        conn.release();
        process.exit(0);
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
checkTables();
//# sourceMappingURL=check_required_tables.js.map