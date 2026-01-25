
const mysql = require('mysql2/promise');

async function debugNotifications() {
    console.log('Connecting to database...');
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'billing',
            port: 3306 // Explicit port
        });

        console.log('Connected! Fetching failed notifications...');

        const [rows] = await connection.execute(
            `SELECT id, notification_type, channel, status, retry_count, error_message, created_at 
       FROM unified_notifications_queue 
       WHERE status = 'failed' OR status = 'pending'
       ORDER BY id DESC LIMIT 5`
        );

        console.log('--------------------------------------------------');
        console.log('RECENT NOTIFICATIONS (Failed/Pending):');
        console.log('--------------------------------------------------');

        if (rows.length === 0) {
            console.log('No failed or pending notifications found.');
        }

        rows.forEach(row => {
            console.log(`ID: ${row.id}`);
            console.log(`Type: ${row.notification_type}`);
            console.log(`Status: ${row.status}`);
            console.log(`Retry: ${row.retry_count}`);
            console.log(`Error: ${row.error_message}`);
            console.log(`Created: ${row.created_at}`);
            console.log('-------------------');
        });

        // Also check if templates exist
        const [templates] = await connection.execute(
            `SELECT template_code, is_active FROM notification_templates WHERE template_code IN ('broadcast', 'invoice_created')`
        );
        console.log('TEMPLATES CHECK:');
        console.log(JSON.stringify(templates, null, 2));

        await connection.end();
    } catch (error) {
        console.error('CONNECTION ERROR:', error.message);
        if (error.code === 'ECONNREFUSE') {
            console.log('Try checking if MySQL is running on port 3306.');
        }
    }
}

debugNotifications();
