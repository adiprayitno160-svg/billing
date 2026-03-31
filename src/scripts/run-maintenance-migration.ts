
import { createMaintenanceSchedulesTable } from '../db/migrations/create-maintenance-schedules-table';
import { databasePool } from '../db/pool';

async function run() {
    try {
        console.log('Starting maintenance schedules table migration...');
        await createMaintenanceSchedulesTable();
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

run();
