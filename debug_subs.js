
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
            database: process.env.DB_NAME || process.env.DB_DATABASE || 'billing_db'
        });

        console.log('--- Subscriptions Check for "Citra Diah" ---');
        // First get customer ID
        const [custs] = await conn.execute("SELECT id, name FROM customers WHERE name LIKE '%Citra Diah%'");
        if (custs.length === 0) {
            console.log('Customer not found?');
            return;
        }
        const cid = custs[0].id;
        console.log(`Customer ID: ${cid}`);

        const [subs] = await conn.execute(
            "SELECT id, customer_id, package_name, status, created_at FROM subscriptions WHERE customer_id = ?",
            [cid]
        );
        console.table(subs);

        if (subs.length > 1) {
            console.log('⚠️ FOUND MULTIPLE SUBSCRIPTIONS! This causes the duplicate view.');
            // Delete duplicates, keep newest or active?
            // Usually there should be only 1 'active' subscription.

            const activeSubs = subs.filter(s => s.status === 'active');
            console.log(`Active Subscriptions: ${activeSubs.length}`);

            if (activeSubs.length > 1) {
                // Delete all but the newest active one
                const sorted = activeSubs.sort((a, b) => b.id - a.id);
                const keeper = sorted[0];
                console.log(`Keeping Subscription ID: ${keeper.id}`);

                for (const s of sorted) {
                    if (s.id !== keeper.id) {
                        console.log(`Deleting Duplicate Subscription ID: ${s.id}`);
                        await conn.execute('DELETE FROM subscriptions WHERE id = ?', [s.id]);
                    }
                }
                console.log('✅ Cleanup complete.');
            }
        } else {
            console.log('Subscriptions look unique.');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (conn) conn.end();
    }
})();
