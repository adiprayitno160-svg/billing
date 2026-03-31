import { databasePool } from './src/db/pool';

async function listAllCustomers() {
    try {
        console.log("Listing some active customers...");
        const [customers]: any = await databasePool.query("SELECT id, name, status FROM customers WHERE status = 'active' LIMIT 100");
        console.log('Active Customers (first 100):', JSON.stringify(customers, null, 2));

        console.log("\nSearching for 'Lusi' or 'Sawo' with case insensitive...");
        const [search]: any = await databasePool.query("SELECT id, name, status FROM customers WHERE name LIKE '%Lusi%' OR name LIKE '%Sawo%'");
        console.log('Search Result:', JSON.stringify(search, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

listAllCustomers();
