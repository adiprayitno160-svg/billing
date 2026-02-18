
import { databasePool } from './src/db/pool';
async function test() {
    const [rows] = await databasePool.query('DESC unified_notifications_queue');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
}
test();
