import { databasePool } from './src/db/pool';

async function searchLusi() {
    try {
        console.log("Searching for 'Lusi Sawo'...");
        const [customers]: any = await databasePool.query("SELECT * FROM customers WHERE name LIKE '%Lusi%' OR name LIKE '%Sawo%'");
        console.log('Found Customers:', JSON.stringify(customers, null, 2));

        if (customers.length > 0) {
            for (const customer of (customers as any[])) {
                console.log(`\n--- Customer ID ${customer.id} (${customer.name}) ---`);
                const [subs]: any = await databasePool.query('SELECT * FROM subscriptions WHERE customer_id = ?', [customer.id]);
                console.log('Subscriptions:', JSON.stringify(subs, null, 2));

                const [allInvoices]: any = await databasePool.query('SELECT id, period, status, total_amount, remaining_amount FROM invoices WHERE customer_id = ? ORDER BY period DESC', [customer.id]);
                console.log('Last Invoices:', JSON.stringify(Array.isArray(allInvoices) ? allInvoices.slice(0, 5) : allInvoices, null, 2));
            }
        } else {
            console.log('No customers found with that name.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

searchLusi();
