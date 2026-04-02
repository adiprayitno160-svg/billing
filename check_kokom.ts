
import { databasePool } from './src/db/pool';

async function check() {
    try {
        const [rows] = await databasePool.query('SELECT id, name, customer_code FROM customers ORDER BY updated_at DESC LIMIT 20') as [any[], any];
        console.log('--- CUSTOMERS ---');
        console.log(JSON.stringify(rows, null, 2));
        
        if (rows.length > 0) {
            const customerId = rows[0].id;
            const [invoices] = await databasePool.query('SELECT id, invoice_number, period, total_amount, paid_amount, remaining_amount, status FROM invoices WHERE customer_id = ?', [customerId]);
            console.log('--- INVOICES ---');
            console.log(JSON.stringify(invoices, null, 2));
            
            const [payments] = await databasePool.query('SELECT p.*, i.invoice_number FROM payments p LEFT JOIN invoices i ON p.invoice_id = i.id WHERE i.customer_id = ?', [customerId]);
            console.log('--- PAYMENTS ---');
            console.log(JSON.stringify(payments, null, 2));
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

check();
