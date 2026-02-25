
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing',
            connectTimeout: 5000
        });
        const [rows] = await conn.query('SELECT id, invoice_number, total_amount FROM invoices ORDER BY id DESC LIMIT 5');
        console.log(JSON.stringify(rows));
        await conn.end();
    } catch (err) {
        console.error('Check failed:', err.message);
    } finally {
        process.exit();
    }
}

check();
