
import { databasePool } from './src/db/pool';

async function checkSchema() {
    try {
        const [cols] = await databasePool.query('DESCRIBE customer_notifications_log');
        console.log('Columns in customer_notifications_log:', cols);
        process.exit(0);
    } catch (e) {
        console.error('Error checking schema:', e);
        process.exit(1);
    }
}

checkSchema();
