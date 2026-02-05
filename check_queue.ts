
import { databasePool } from './src/db/pool';

async function checkQueue() {
    try {
        const [rows] = await databasePool.query('SELECT id, status, channel, scheduled_for, created_at FROM unified_notifications_queue WHERE status = "pending" ORDER BY id DESC LIMIT 10');
        console.log('Pending Notifications:');
        console.table(rows);

        const [timeRows] = await databasePool.query('SELECT NOW() as dbNow');
        console.log('DB Time:', (timeRows as any)[0].dbNow);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkQueue();
