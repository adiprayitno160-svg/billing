
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkLive() {
    const liveIP = '192.168.239.154';
    console.log(`Checking Live Server: ${liveIP}...`);

    try {
        const connection = await mysql.createConnection({
            host: liveIP,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectTimeout: 5000
        });

        console.log('✅ Success connecting to Live DB!');

        // Search for Wildan or Yeni in manual_payment_verifications
        const [verifications] = await connection.query(`
            SELECT v.id, v.customer_id, c.name as customer_name, v.status, v.reason, v.created_at
            FROM manual_payment_verifications v
            LEFT JOIN customers c ON v.customer_id = c.id
            WHERE c.name LIKE '%Wildan%' OR c.name LIKE '%Yeni%'
               OR v.reason LIKE '%Wildan%' OR v.reason LIKE '%Yeni%'
            ORDER BY v.created_at DESC
        `);
        console.log('--- Verifications Found ---');
        console.log(JSON.stringify(verifications, null, 2));

        // Search for pending notifications
        const [notifs] = await connection.query(`
            SELECT id, customer_id, channel, status, error_message, created_at
            FROM unified_notifications_queue
            WHERE status != 'sent'
            ORDER BY created_at DESC
            LIMIT 20
        `);
        console.log('--- Non-Sent Notifications ---');
        console.log(JSON.stringify(notifs, null, 2));

        await connection.end();
    } catch (err) {
        console.log(`❌ Connection Error to ${liveIP}: ${err.message}`);
        if (err.code === 'ETIMEDOUT') {
            console.log('Hint: The server is reachable (Ping OK) but the MySQL port (3306) is not responding.');
        }
    }
}
checkLive();
