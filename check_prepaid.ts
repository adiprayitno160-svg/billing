
import { databasePool } from './src/db/pool';

async function checkPrepaidSchema() {
    try {
        const [rows] = await databasePool.query("SHOW COLUMNS FROM prepaid_transactions");
        console.log('Prepaid Columns:', rows);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkPrepaidSchema();
