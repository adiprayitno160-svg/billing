
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
        console.log('Connected!');
        const [rows] = await conn.query('SHOW VARIABLES LIKE "max_connections"');
        console.log(JSON.stringify(rows));
        const [status] = await conn.query('SHOW STATUS LIKE "Threads_connected"');
        console.log(JSON.stringify(status));
        await conn.end();
    } catch (err) {
        console.error('Connection failed:', err.message);
    } finally {
        process.exit();
    }
}

check();
