
import { databasePool } from './src/db/pool';
async function checkInvoices() {
    try {
        const [rows] = await databasePool.query('SELECT COUNT(*) as count FROM invoices');
        console.log('Invoice count:', (rows as any)[0].count);
        const [latest] = await databasePool.query('SELECT * FROM invoices ORDER BY id DESC LIMIT 1');
        console.log('Latest invoice:', latest);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
checkInvoices();
