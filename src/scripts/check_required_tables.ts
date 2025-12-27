import { databasePool } from '../db/pool';

async function checkTables() {
    try {
        const conn = await databasePool.getConnection();

        try {
            await conn.query("SHOW COLUMNS FROM sla_records");
            console.log('sla_records table exists.');
        } catch (e) {
            console.log('sla_records table MISSING.');
        }

        try {
            await conn.query("SHOW COLUMNS FROM discounts");
            console.log('discounts table exists.');
        } catch (e) {
            console.log('discounts table MISSING.');
        }

        conn.release();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkTables();
