import { databasePool } from './src/db/pool';

async function checkLusi() {
    try {
        console.log('--- Customer 152 ---');
        const [customer] = await databasePool.query('SELECT * FROM customers WHERE id = 152');
        console.log('Customer:', JSON.stringify(customer, null, 2));

        console.log('\n--- Subscriptions ---');
        const [subs] = await databasePool.query('SELECT * FROM subscriptions WHERE customer_id = 152');
        console.log('Subscriptions:', JSON.stringify(subs, null, 2));

        console.log('\n--- Invoices for 2026-03 ---');
        const [invoices] = await databasePool.query("SELECT * FROM invoices WHERE customer_id = 152 AND period = '2026-03'");
        console.log('Invoices:', JSON.stringify(invoices, null, 2));

        console.log('\n--- Invoices for 2026-04 ---');
        const [invoicesNext] = await databasePool.query("SELECT * FROM invoices WHERE customer_id = 152 AND period = '2026-04'");
        console.log('Invoices Next:', JSON.stringify(invoicesNext, null, 2));

        console.log('\n--- All Invoices ---');
        const [allInvoices] = await databasePool.query('SELECT id, period, status, total_amount, remaining_amount FROM invoices WHERE customer_id = 152 ORDER BY period DESC');
        console.log('All Invoices:', JSON.stringify(allInvoices, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkLusi();
