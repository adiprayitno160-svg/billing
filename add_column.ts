
import { databasePool } from './src/db/pool';
async function run() {
    try {
        console.log('Checking columns for unified_notifications_queue...');
        const [cols]: any = await databasePool.query("SHOW COLUMNS FROM unified_notifications_queue LIKE 'attachment_path'");
        if (cols.length === 0) {
            console.log('Adding attachment_path column...');
            await databasePool.query("ALTER TABLE unified_notifications_queue ADD COLUMN attachment_path TEXT NULL AFTER message");
            console.log('Column added successfully');
        } else {
            console.log('Column already exists');
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit(0);
    }
}
run();
