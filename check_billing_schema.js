const mysql = require('mysql2/promise');
require('dotenv').config();

async function describeBillingTables() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing_db'
    });

    try {
        console.log('--- TABLE STRUCTURES ---');

        const tables = ['invoices', 'subscriptions', 'mikrotik_settings'];

        for (const t of tables) {
            console.log(`\nAvailable columns in ${t}:`);
            const [cols] = await conn.query(`DESCRIBE ${t}`);
            console.table(cols);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}

describeBillingTables();
