
import { databasePool } from './src/db/pool';

async function checkCustomerData() {
    try {
        console.log('--- Checking Customer Data for Arum Besole ---');

        // Find customer
        const [customers] = await databasePool.query(`
            SELECT c.id, c.name, c.pppoe_username, c.customer_code
            FROM customers c 
            WHERE c.name LIKE '%Arum%'
            LIMIT 3
        `);

        console.log('Customers found:', customers);

        if ((customers as any[]).length > 0) {
            const customerId = (customers as any[])[0].id;

            // Check subscriptions
            const [subs] = await databasePool.query(`
                SELECT s.*, pp.name as pkg_name, pp.rate_limit_rx, pp.rate_limit_tx
                FROM subscriptions s
                LEFT JOIN pppoe_packages pp ON s.package_id = pp.id
                WHERE s.customer_id = ?
            `, [customerId]);

            console.log('\nSubscriptions:', subs);

            // Check customer table fields
            const [customerFull] = await databasePool.query(`
                SELECT * FROM customers WHERE id = ?
            `, [customerId]);

            console.log('\nFull customer data:', customerFull);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await databasePool.end();
        process.exit();
    }
}

checkCustomerData();
