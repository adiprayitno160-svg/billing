"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./src/db/pool");
async function checkTables() {
    try {
        const [tables] = await pool_1.databasePool.query('SHOW TABLES');
        console.log('Available Tables:', tables);
        const [logsExist] = await pool_1.databasePool.query("SHOW TABLES LIKE 'notification_logs'");
        console.log('notification_logs exists:', logsExist.length > 0);
        const [queueExist] = await pool_1.databasePool.query("SHOW TABLES LIKE 'unified_notifications_queue'");
        console.log('unified_notifications_queue exists:', queueExist.length > 0);
        process.exit(0);
    }
    catch (e) {
        console.error('Error checking tables:', e);
        process.exit(1);
    }
}
checkTables();
//# sourceMappingURL=check_tables.js.map