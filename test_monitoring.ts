
import { databasePool } from './src/db/pool';
import pingService from './src/services/pingService';

async function runTest() {
    try {
        console.log('--- 1. CREATING DUMMY DATA ---');

        // 1. Create Customer
        const [custResult] = await databasePool.query<any>(`
            INSERT INTO customers (customer_code, name, status, created_at, updated_at)
            VALUES ('CUS-TEST-PING', 'TEST PING USER', 'active', NOW(), NOW())
        `);
        const customerId = custResult.insertId;
        console.log(`Created Customer ID: ${customerId}`);

        // 2. Create Static IP Client
        // Note: Using IP 192.168.5.211 as requested
        const ip = '192.168.5.211';
        const [clientResult] = await databasePool.query<any>(`
            INSERT INTO static_ip_clients 
            (package_id, customer_id, client_name, ip_address, status, created_at, updated_at)
            VALUES (1, ?, 'TEST PING CLIENT', ?, 'active', NOW(), NOW())
        `, [customerId, ip]);
        console.log(`Created Static IP Client ID: ${clientResult.insertId} with IP ${ip}`);

        console.log('\n--- 2. RUNNING MONITORING MANUAL ---');

        // Force monitoring run
        await pingService.monitorAllStaticIPs();

        console.log('\n--- 3. CHECKING RESULTS ---');

        const [rows] = await databasePool.query<any>(`
            SELECT * FROM static_ip_ping_status WHERE customer_id = ?
        `, [customerId]);

        console.log('Ping Status Result:', rows[0]);

        if (rows.length > 0 && rows[0].status === 'online') {
            console.log('✅ SUCCESS! IP is detected as ONLINE.');
        } else {
            console.log('❌ FAILED. IP is OFFLINE or UNKNOWN.');
            console.log('Make sure 192.168.5.211 is reachable from this machine!');
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

runTest();
