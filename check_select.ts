
import { databasePool } from './src/db/pool';

async function checkSelect() {
    try {
        const [rows] = await databasePool.query("SELECT verified_by FROM manual_payment_verifications LIMIT 1");
        console.log('Select Result:', rows);
    } catch (error) {
        console.error('Select Error:', error);
    } finally {
        process.exit();
    }
}

checkSelect();
