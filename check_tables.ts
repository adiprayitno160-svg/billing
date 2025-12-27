
import { databasePool } from './src/db/pool';

async function checkTables() {
    try {
        const [tables] = await databasePool.query('SHOW TABLES');
        console.log('Available Tables:', tables);

        const [logsExist] = await databasePool.query("SHOW TABLES LIKE 'notification_logs'");
        console.log('notification_logs exists:', (logsExist as any).length > 0);

        const [queueExist] = await databasePool.query("SHOW TABLES LIKE 'unified_notifications_queue'");
        console.log('unified_notifications_queue exists:', (queueExist as any).length > 0);

        process.exit(0);
    } catch (e) {
        console.error('Error checking tables:', e);
        process.exit(1);
    }
}

checkTables();
