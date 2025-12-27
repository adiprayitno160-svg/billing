"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./src/db/pool");
async function checkSchema() {
    try {
        const [cols] = await pool_1.databasePool.query('DESCRIBE unified_notifications_queue');
        console.log('Columns in unified_notifications_queue:', cols);
        const [cols2] = await pool_1.databasePool.query('DESCRIBE notification_logs');
        console.log('Columns in notification_logs:', cols2);
        process.exit(0);
    }
    catch (e) {
        console.error('Error checking schema:', e);
        process.exit(1);
    }
}
checkSchema();
//# sourceMappingURL=check_schema.js.map