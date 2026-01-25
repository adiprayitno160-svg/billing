const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });

    const namePattern = '%Winda%';
    const [rows] = await connection.execute('SELECT id, name, connection_type, status FROM customers WHERE name LIKE ?', [namePattern]);
    console.log('Results:', rows);

    if (rows.length > 0) {
        const id = rows[0].id;
        const [invs] = await connection.execute('SELECT * FROM invoices WHERE customer_id = ? AND period = ?', [id, '2026-01']);
        console.log('Invoices:', invs);

        const [subs] = await connection.execute('SELECT * FROM subscriptions WHERE customer_id = ?', [id]);
        console.log('Subs:', subs);
    }

    await connection.end();
}

run().catch(console.error);
