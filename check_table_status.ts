
import { databasePool } from './src/db/pool';

async function checkTableStatus() {
    try {
        const [rows] = await databasePool.query("SHOW FULL TABLES LIKE 'manual_payment_verifications'");
        console.log('Table Info:', rows);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkTableStatus();
