
import { databasePool } from './src/db/pool';

async function checkTriggers() {
    try {
        const [rows] = await databasePool.query("SHOW TRIGGERS LIKE 'manual_payment_verifications'");
        console.log(rows);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkTriggers();
