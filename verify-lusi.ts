import { databasePool } from './src/db/pool';

async function verifyLusi() {
    process.env.DB_PASSWORD = 'adi'; // Force password from .env_server
    try {
        console.log("Verifying 'Lusi Sawo' with ID 152 and specified DB password...");
        const [customer]: any = await databasePool.query("SELECT * FROM customers WHERE id = 152 OR name LIKE '%Lusi%'");
        console.log('Customer Data:', JSON.stringify(customer, null, 2));

        if (customer.length > 0) {
            const cid = customer[0].id;
            const [invoices]: any = await databasePool.query("SELECT * FROM invoices WHERE customer_id = ? ORDER BY period DESC", [cid]);
            console.log('Invoices:', JSON.stringify(invoices, null, 2));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

verifyLusi();
