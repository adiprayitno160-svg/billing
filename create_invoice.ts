
import { databasePool } from './src/db/pool';

async function createDummyInvoice() {
    try {
        const customerId = 85;
        const invoiceNumber = 'INV/TEST/' + Date.now();
        const amount = 100000; // 100k
        const period = '2026-01';
        const dueDate = '2026-01-31';

        await databasePool.query(
            "INSERT INTO invoices (customer_id, invoice_number, total_amount, period, due_date, status) VALUES (?, ?, ?, ?, ?, ?)",
            [customerId, invoiceNumber, amount, period, dueDate, 'sent']
        );
        console.log('Created dummy invoice:', invoiceNumber, 'for customer:', customerId);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createDummyInvoice();
