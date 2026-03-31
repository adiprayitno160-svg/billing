import { databasePool } from '../src/db/pool';

async function run() {
    try {
        const [customers] = await databasePool.query("SELECT * FROM customers WHERE name LIKE '%sugondo%' OR name LIKE '%Sugondo%'");
        const results = customers as any[];
        console.log('CUSTOMERS:');
        console.log(results);
        
        if (results.length > 0) {
            const customerId = results[0].id;
            const [isolations] = await databasePool.query("SELECT action, reason, created_at FROM isolation_logs WHERE customer_id = ? ORDER BY created_at DESC", [customerId]);
            console.log('\nISOLATION LOGS:');
            console.log(isolations);

            const [activations] = await databasePool.query("SELECT action, reason, created_at FROM activation_logs WHERE customer_id = ? ORDER BY created_at DESC", [customerId]);
            console.log('\nACTIVATION LOGS:');
            console.log(activations);
        }
    } catch(e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
