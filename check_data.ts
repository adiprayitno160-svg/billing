
import { databasePool } from './src/db/pool';

async function checkData() {
    try {
        const [rows] = await databasePool.query('SELECT COUNT(*) as count FROM registration_requests');
        console.log('Registration Requests Count:', (rows as any)[0].count);

        // Also check if any recent notifications were sent
        const [notifs] = await databasePool.query('SELECT * FROM unified_notifications_queue ORDER BY created_at DESC LIMIT 5');
        console.log('Recent Notifications:', notifs);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkData();
