import { databasePool } from './db/pool';
import fs from 'fs';

async function main() {
    console.log("Starting query for Yudi...");
    // Let's find customer first to be sure
    const [customers] = await databasePool.query('SELECT id, name FROM customers WHERE name LIKE "%Yudi%"');
    console.log("Customers found:", customers);
    
    const [invoices] = await databasePool.query('SELECT * FROM invoices WHERE customer_id = 55');
    console.log("Invoices found for ID 55:", (invoices as any[]).length);
    
    const data = {
        customers,
        invoices
    };
    
    fs.writeFileSync('yudi_debug_results.json', JSON.stringify(data, null, 2));
    console.log("Results written to yudi_debug_results.json");
    
    // Check Feb 2026 specifically
    const [feb] = await databasePool.query('SELECT * FROM invoices WHERE customer_id = 55 AND period = "2026-02"');
    console.log("Feb 2026 Invoice:", feb);
    
    await databasePool.end();
}

main().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
