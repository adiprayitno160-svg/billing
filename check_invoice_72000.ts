
import { databasePool } from './src/db/pool';

async function checkInvoice72000() {
    try {
        const query = `
            SELECT i.*, c.name as customer_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE i.remaining_amount = 72000
        `;
        const [rows] = await databasePool.query(query) as any;
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
checkInvoice72000();
