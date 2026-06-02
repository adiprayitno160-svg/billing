"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./db/pool");
async function debugLusi() {
    try {
        console.log('Checking Lusi Sawo (ID 152) data...');
        const [customer] = await pool_1.databasePool.query('SELECT * FROM customers WHERE id = 152');
        console.log('Customer:', JSON.stringify(customer, null, 2));
        const [subs] = await pool_1.databasePool.query('SELECT * FROM subscriptions WHERE customer_id = 152');
        console.log('Subscriptions:', JSON.stringify(subs, null, 2));
        const [invoices] = await pool_1.databasePool.query('SELECT * FROM invoices WHERE customer_id = 152 ORDER BY period DESC');
        console.log('Invoices:', JSON.stringify(invoices, null, 2));
        const [notifs] = await pool_1.databasePool.query('SELECT * FROM unified_notifications_queue WHERE customer_id = 152 ORDER BY id DESC LIMIT 5');
        console.log('Notifications:', JSON.stringify(notifs, null, 2));
    }
    catch (err) {
        console.error('Debug error:', err);
    }
    finally {
        process.exit();
    }
}
debugLusi();
//# sourceMappingURL=debug-lusi.js.map