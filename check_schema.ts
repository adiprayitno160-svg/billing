
import { databasePool } from './src/db/pool';

async function checkSchema() {
    try {
        const [cols] = await databasePool.query('DESCRIBE unified_notifications_queue');
        console.log('Columns in unified_notifications_queue:', cols);

        const [cols2] = await databasePool.query('DESCRIBE notification_logs');
        console.log('Columns in notification_logs:', cols2);

        process.exit(0);
    } catch (e) {
        console.error('Error checking schema:', e);
        process.exit(1);
    }
}

checkSchema();
