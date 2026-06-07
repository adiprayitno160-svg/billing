const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });
    const [rows] = await conn.query("SELECT c.id, c.name, s.status, s.last_offline_at FROM customers c JOIN static_ip_ping_status s ON c.id=s.customer_id WHERE c.connection_type='pppoe' AND s.status='offline' LIMIT 10");
    console.log("Offline PPPoE Customers:", rows);
    conn.end();
}
main();
