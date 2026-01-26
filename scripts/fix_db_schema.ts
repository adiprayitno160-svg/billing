
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

        // Check pppoe_packages table for missing capacity columns
        console.log('Checking pppoe_packages table columns...');
        const [pppoeCols] = await connection.query<any[]>('SHOW COLUMNS FROM pppoe_packages');
        const pppoeColNames = pppoeCols.map(c => c.Field);

        if (!pppoeColNames.includes('max_clients')) {
            console.log('Adding missing column: pppoe_packages.max_clients');
            await connection.query('ALTER TABLE pppoe_packages ADD COLUMN max_clients INT DEFAULT 1 AFTER is_enabled_30_days');
        }

        if (!pppoeColNames.includes('limit_at_upload')) {
            console.log('Adding missing column: pppoe_packages.limit_at_upload');
            await connection.query('ALTER TABLE pppoe_packages ADD COLUMN limit_at_upload VARCHAR(50) NULL AFTER max_clients');
        }

        if (!pppoeColNames.includes('limit_at_download')) {
            console.log('Adding missing column: pppoe_packages.limit_at_download');
            await connection.query('ALTER TABLE pppoe_packages ADD COLUMN limit_at_download VARCHAR(50) NULL AFTER limit_at_upload');
        }

        console.log('✅ pppoe_packages schema check completed.');

    } catch (error) {
        console.error('❌ Error updating database schema:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

fixSchema();
