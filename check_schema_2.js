"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./src/db/pool");
async function checkSchema() {
    try {
        const [cols] = await pool_1.databasePool.query('DESCRIBE customer_notifications_log');
        console.log('Columns in customer_notifications_log:', cols);
        process.exit(0);
    }
    catch (e) {
        console.error('Error checking schema:', e);
        process.exit(1);
    }
}
checkSchema();
//# sourceMappingURL=check_schema_2.js.map