
import { databasePool } from './src/db/pool';
import pingService from './src/services/pingService';
import { RowDataPacket } from 'mysql2';

async function runTestUpdate() {
    try {
        console.log('--- 1. UPDATING DUMMY DATA ---');

        // Find the test user created earlier
        const [custRows] = await databasePool.query<RowDataPacket[]>('SELECT id FROM customers WHERE customer_code = ?', ['CUS-TEST-PING']);

        if (custRows.length === 0) {
            console.log('Test customer not found. Creating minimal dummy data for existing customer scenario...');
            // Fallback: Create if not exists (User said dont create new, but if I cant find the one I made, I must use something)
            // But let's assume the previous script ran successfully.
            console.log('SKIPPING: No dummy customer found to update. Please run the previous script first or provide an ID.');
            return;
        }

        const customerId = custRows[0].id;
        const newIp = '192.168.240.82';

        console.log(`Updating Customer ID: ${customerId} to IP ${newIp}`);

        // Update Static IP Client
        await databasePool.query(`
            UPDATE static_ip_clients 
            SET ip_address = ?
            WHERE customer_id = ?
        `, [newIp, customerId]);

        // Clean ping status first to ensure fresh check
        await databasePool.query('DELETE FROM static_ip_ping_status WHERE customer_id = ?', [customerId]);

        console.log('\n--- 2. RUNNING MONITORING MANUAL ---');

        // Force monitoring run
        await pingService.monitorAllStaticIPs();

        console.log('\n--- 3. CHECKING RESULTS ---');

        const [rows] = await databasePool.query<any>(`
            SELECT * FROM static_ip_ping_status WHERE customer_id = ?
        `, [customerId]);

        if (rows.length > 0) {
            console.log('Ping Status Result:', rows[0]);
            console.log(`Status: ${rows[0].status}`);
            if (rows[0].status === 'online') {
                console.log('✅ SUCCESS! IP is detected as ONLINE.');
            } else {
                console.log('❌ OFFLINE. (Expected if this IP is not reachable from local machine)');
            }
        } else {
            console.log('❌ NO DATA. Monitoring might have failed silently.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

runTestUpdate();
