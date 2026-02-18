
import { databasePool } from './src/db/pool';
async function test() {
    try {
        const [rows] = await databasePool.query("SHOW TABLES LIKE 'invoice_items'");
        console.log('invoice_items exists:', rows);
        const [inv] = await databasePool.query("SELECT id FROM invoices LIMIT 1");
        console.log('First invoice:', inv);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
