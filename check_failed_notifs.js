
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function checkFailedNotifications() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });

    try {
        const [rows] = await connection.execute(
            'SELECT id, customer_id, notification_type, status, retry_count, error_message, created_at FROM unified_notifications_queue WHERE status = "failed" ORDER BY id DESC LIMIT 10'
        );
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkFailedNotifications();
