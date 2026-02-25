
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
        const [rows] = await conn.query('SHOW TABLES LIKE "customer_compensations"');
        console.log('customer_compensations exists:', rows.length > 0);
        if (rows.length > 0) {
            const [cols] = await conn.query('SHOW COLUMNS FROM customer_compensations');
            console.log('Columns:', JSON.stringify(cols));
        }
        await conn.end();
    } catch (err) {
        console.error('Check failed:', err.message);
    } finally {
        process.exit();
    }
}

check();
