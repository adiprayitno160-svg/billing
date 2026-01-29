
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

        console.log('--- CUSTOMERS Table (Citra) ---');
        const [customers] = await conn.execute("SELECT id, name, created_at FROM customers WHERE name LIKE '%Citra Diah%'");
        console.table(customers);

        console.log('\n--- STATIC IP CLIENTS Table (Citra) ---');
        const [statics] = await conn.execute("SELECT id, client_name, customer_id, ip_address FROM static_ip_clients WHERE client_name LIKE '%Citra Diah%'");
        console.table(statics);

        // Check for double Customer records
        if (customers.length > 1) {
            console.log('\n⚠️ Found DUPLICATE Customers!');

            // Logic: Keep the one that is linked to the existing static_ip_client
            // If static ip client exists
            if (statics.length > 0) {
                const activeCustomerId = statics[0].customer_id;
                console.log(`Active Static IP Client is linked to Customer ID: ${activeCustomerId}`);

                // Delete others
                for (const c of customers) {
                    if (c.id !== activeCustomerId) {
                        console.log(`Deleting ORPHAN/DUPLICATE Customer ID: ${c.id}`);
                        await conn.execute('DELETE FROM customers WHERE id = ?', [c.id]);
                        console.log('✅ Deleted.');
                    } else {
                        console.log(`Keeping Active Customer ID: ${c.id}`);
                    }
                }
            } else {
                // If no static IP exists (weird), delete all but newest?
                // Just delete duplicate latest
                const victim = customers.sort((a, b) => b.id - a.id)[0];
                console.log(`Deleting Newest Duplicate Customer ID: ${victim.id}`);
                await conn.execute('DELETE FROM customers WHERE id = ?', [victim.id]);
                console.log('✅ Deleted.');
            }
        } else {
            console.log('✅ Customers table is clean.');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (conn) conn.end();
    }
})();
