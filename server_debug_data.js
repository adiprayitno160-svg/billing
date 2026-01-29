
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

        console.log('--- RECENT STATIC IP CLIENTS ---');
        const [statics] = await conn.execute('SELECT id, client_name, ip_address, customer_id FROM static_ip_clients ORDER BY id DESC LIMIT 5');
        console.table(statics);

        console.log('\n--- RECENT CUSTOMERS (Master Table) ---');
        // Check if records exist in the main customers table
        const [customers] = await conn.execute("SELECT id, name, created_at FROM customers WHERE name LIKE '%Citra%' ORDER BY id DESC LIMIT 5");
        console.table(customers);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (conn) conn.end();
    }
})();
