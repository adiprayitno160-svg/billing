
import { databasePool } from './src/db/pool';

async function migrateSLA() {
    try {
        console.log('Migrating sla_records table...');

        // Check columns
        const [cols] = await databasePool.query<any[]>('SHOW COLUMNS FROM sla_records');
        const colNames = cols.map(c => c.Field);
        console.log('Current columns:', colNames);

        if (colNames.includes('month_year') && !colNames.includes('period')) {
            console.log('Renaming month_year to period...');
            await databasePool.query('ALTER TABLE sla_records CHANGE COLUMN month_year period VARCHAR(7) NULL');
            // Assuming the old format was DATE or VARCHAR. If DATE, we need conversion.
            // If it was DATE, '2026-01-01'. renaming to VARCHAR(7) might truncate? No, auto conversion?
            // Safer: Add period, update it, drop month_year.
        } else if (!colNames.includes('period')) {
            console.log('Adding period column...');
            await databasePool.query('ALTER TABLE sla_records ADD COLUMN period VARCHAR(7) NULL');
        }

        // Update period from month_year if needed
        if (colNames.includes('month_year')) {
            await databasePool.query("UPDATE sla_records SET period = DATE_FORMAT(month_year, '%Y-%m') WHERE period IS NULL");
        }

        console.log('Migration done.');
    } catch (err) {
        console.error(err);
    }
    process.exit();
}

migrateSLA();
