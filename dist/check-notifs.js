"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./db/pool");
async function checkNotifs() {
    try {
        const [rows] = await pool_1.databasePool.query('SELECT id, customer_id, notification_type, channel, status, error_message, created_at, attachment_path FROM unified_notifications_queue WHERE status != "sent" ORDER BY id DESC LIMIT 10');
        console.log('Unsent Notifications:', JSON.stringify(rows, null, 2));
    }
    catch (err) {
        console.error('Check error:', err);
    }
    finally {
        process.exit();
    }
}
checkNotifs();
//# sourceMappingURL=check-notifs.js.map