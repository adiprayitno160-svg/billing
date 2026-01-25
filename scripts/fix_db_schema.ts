
import { databasePool } from '../src/db/pool';

async function fixSchema() {
    const connection = await databasePool.getConnection();
    try {
        console.log('Checking unified_notifications_queue table...');

        // Check if attachment_path column exists
        const [columns] = await connection.query<any[]>('SHOW COLUMNS FROM unified_notifications_queue LIKE "attachment_path"');

        if (columns.length === 0) {
            console.log('Adding missing column: attachment_path');
            await connection.query('ALTER TABLE unified_notifications_queue ADD COLUMN attachment_path VARCHAR(255) NULL AFTER message');
            console.log('✅ Column added successfully.');
        } else {
            console.log('ℹ️ Column attachment_path already exists.');
        }

    } catch (error) {
        console.error('❌ Error updating database schema:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

fixSchema();
