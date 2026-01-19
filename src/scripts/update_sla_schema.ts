import { databasePool } from '../db/pool';

const updateSlaSchema = async () => {
    console.log('🔄 Updating Database Schema for SLA Monitoring...');

    try {
        // Check if columns exist
        const [columns] = await databasePool.query<any[]>(
            `SELECT COLUMN_NAME 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'customers' 
             AND COLUMN_NAME IN ('ignore_monitoring_start', 'ignore_monitoring_end')`
        );

        const existingColumns = columns.map(c => c.COLUMN_NAME);

        if (!existingColumns.includes('ignore_monitoring_start')) {
            console.log('Adding column: ignore_monitoring_start');
            await databasePool.query(
                "ALTER TABLE customers ADD COLUMN ignore_monitoring_start TIME NULL DEFAULT NULL" // Append to end
            );
        } else {
            console.log('Column ignore_monitoring_start already exists.');
        }

        if (!existingColumns.includes('ignore_monitoring_end')) {
            console.log('Adding column: ignore_monitoring_end');
            await databasePool.query(
                "ALTER TABLE customers ADD COLUMN ignore_monitoring_end TIME NULL DEFAULT NULL AFTER ignore_monitoring_start"
            );
        } else {
            console.log('Column ignore_monitoring_end already exists.');
        }

        console.log('✅ SLA Schema Update Complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating schema:', error);
        process.exit(1);
    }
};

updateSlaSchema();
