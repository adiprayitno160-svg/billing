
import { databasePool } from '../src/db/pool';

async function findSheril() {
    try {
        const [customers]: any = await databasePool.query(
            "SELECT id, name, customer_code, balance, status FROM customers WHERE name LIKE '%Sheril%'"
        );
        console.log('Customers found:', JSON.stringify(customers, null, 2));

        if (Array.isArray(customers) && customers.length > 0) {
            for (const customer of customers) {
                const [invoices]: any = await databasePool.query(
                    "SELECT id, invoice_number, period, total_amount, paid_amount, status, due_date FROM invoices WHERE customer_id = ? ORDER BY period DESC LIMIT 5",
                    [customer.id]
                );
                console.log(`Invoices for ${customer.name}:`, JSON.stringify(invoices, null, 2));
                
                const [isolation]: any = await databasePool.query(
                    "SELECT * FROM isolation_watchlist WHERE customer_id = ? AND status = 'blocked'",
                    [customer.id]
                );
                console.log(`Isolation status for ${customer.name}:`, JSON.stringify(isolation, null, 2));
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

findSheril();
