import { databasePool } from './src/db/pool';
import { RowDataPacket } from 'mysql2';

async function fixCollation() {
    const tables = [
        'connection_logs',
        'maintenance_notifications',
        'maintenance_schedules',
        'odcs',
        'odps',
        'olts',
        'sla_incidents',
        'sla_records',
        'static_ip_ping_status',
        'telegram_settings'
    ];

    try {
        console.log('🔄 Starting collation fix...');

        // Disable foreign key checks temporarily to avoid constraint errors
        await databasePool.query('SET FOREIGN_KEY_CHECKS = 0');

        for (const table of tables) {
            console.log(`Fixing table: ${table}...`);
            // CONVERT TO automatically converts columns and table default
            await databasePool.query(`ALTER TABLE ${table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            console.log(`✅ Fixed: ${table}`);
        }

        // Re-enable foreign key checks
        await databasePool.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('\n✅ All specified tables have been converted to utf8mb4_unicode_ci.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing collation:', error);
        process.exit(1);
    }
}

fixCollation();
