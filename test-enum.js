const mysql = require('mysql2/promise');
require('dotenv').config();
async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing',
        port: process.env.DB_PORT || 3306
    });
    const [rows] = await conn.query("SHOW COLUMNS FROM invoices LIKE 'status'");
    console.log(rows[0].Type);
    conn.end();
}
run();
