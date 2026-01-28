
import { databasePool } from './src/db/pool';

async function checkTable() {
    try {
        const [rows] = await databasePool.query('DESCRIBE payment_verifications');
        console.log(rows);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkTable();
