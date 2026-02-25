
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('--- Latest Verifications (Local) ---');
        const [rows] = await connection.query(`
            SELECT v.id, v.customer_id, c.name as customer_name, v.extracted_amount, v.status, v.reason, v.created_at
            FROM manual_payment_verifications v
            LEFT JOIN customers c ON v.customer_id = c.id
            ORDER BY v.created_at DESC
            LIMIT 10
        `);
        console.log(JSON.stringify(rows, null, 2));

        console.log('--- Latest Notifications (Local) ---');
        const [notifs] = await connection.query(`
            SELECT id, customer_id, channel, status, error_message, created_at
            FROM unified_notifications_queue
            ORDER BY created_at DESC
            LIMIT 10
        `);
        console.log(JSON.stringify(notifs, null, 2));

        await connection.end();
    } catch (err) {
        console.log('ERROR: ' + err.message);
    }
}
main();
