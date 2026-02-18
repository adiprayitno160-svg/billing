
import { databasePool } from './src/db/pool';
async function test() {
    try {
        const [rows] = await databasePool.query('DESC invoices');
        console.log(JSON.stringify(rows.map((r: any) => r.Field), null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
test();
