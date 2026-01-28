
import { databasePool } from './src/db/pool';

async function checkTable() {
    try {
        const [rows] = await databasePool.query('DESCRIBE prepaid_transactions');
        console.log(rows);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkTable();
