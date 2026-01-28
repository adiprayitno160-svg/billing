
import { databasePool } from './src/db/pool';

async function checkColumns() {
    try {
        const [rows] = await databasePool.query("SHOW COLUMNS FROM manual_payment_verifications");
        console.log('Columns:', rows);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkColumns();
