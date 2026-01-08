
import { databasePool } from './src/db/pool';

async function checkOlt() {
    try {
        const [rows] = await databasePool.query('SELECT * FROM ftth_olt WHERE id = 1');
        console.log('OLT 1:', JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
checkOlt();
