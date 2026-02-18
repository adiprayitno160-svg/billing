
import { databasePool } from './src/db/pool';
import { RowDataPacket } from 'mysql2';

async function checkRecentNotifications() {
    try {
        const [rows] = await databasePool.query<RowDataPacket[]>(
            `SELECT id, customer_id, notification_type, status, error_message, created_at, sent_at, attachment_path 
             FROM unified_notifications_queue 
             WHERE notification_type IN ('payment_received', 'payment_partial') 
             ORDER BY created_at DESC 
             LIMIT 20`
        );
        console.log('--- Recent Payment Notifications ---');
        console.table(rows);
        process.exit(0);
    } catch (error) {
        console.error('Error checking notifications:', error);
        process.exit(1);
    }
}

checkRecentNotifications();
