import { databasePool } from './db/pool';
async function checkNotifs() {
    try {
        const [rows]: any = await databasePool.query('SELECT id, customer_id, notification_type, channel, status, error_message, created_at, attachment_path FROM unified_notifications_queue WHERE status != "sent" ORDER BY id DESC LIMIT 10');
        console.log('Unsent Notifications:', JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error('Check error:', err);
    } finally {
        process.exit();
    }
}
checkNotifs();
