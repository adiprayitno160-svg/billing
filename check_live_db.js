
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    console.log('Connecting to LIVE server DB at 192.168.239.154...');
    const connection = await mysql.createConnection({
        host: '192.168.239.154',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        connectTimeout: 5000
    });

    try {
        console.log('✅ Connected to LIVE database.');

        // 1. Check AI Settings on Live
        const [aiSettings] = await connection.query('SELECT * FROM ai_settings');
        console.log('--- AI Settings (Live) ---');
        console.log(JSON.stringify(aiSettings, null, 2));

        // 2. Search for Wildan Wakhid or Yeni Mayasari in Verifications
        const [verifications] = await connection.query(`
            SELECT v.id, v.customer_id, v.extracted_amount, v.status, v.reason, v.created_at, v.notes
            FROM manual_payment_verifications v
            WHERE v.notes LIKE '%Wildan%' OR v.notes LIKE '%Yeni%'
               OR v.reason LIKE '%Wildan%' OR v.reason LIKE '%Yeni%'
            ORDER BY v.created_at DESC
            LIMIT 20
        `);
        console.log('--- Matching Verifications (Live) ---');
        console.log(JSON.stringify(verifications, null, 2));

        // 3. Search for Customers
        const [customers] = await connection.query(`
            SELECT id, name, phone, email, status FROM customers 
            WHERE name LIKE '%Wildan%' OR name LIKE '%Yeni%'
        `);
        console.log('--- Matching Customers (Live) ---');
        console.log(JSON.stringify(customers, null, 2));

        // 4. Check Pending Verifications in last 24h
        const [pending] = await connection.query(`
            SELECT v.id, v.customer_id, v.extracted_amount, v.status, v.reason, v.created_at
            FROM manual_payment_verifications v
            WHERE v.status = 'pending'
            AND v.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY v.created_at DESC
        `);
        console.log('--- Recent Pending Verifications (Live) ---');
        console.log(JSON.stringify(pending, null, 2));

    } catch (err) {
        console.error('❌ Failed to query LIVE database:', err.message);
    } finally {
        await connection.end();
    }
}
main();
