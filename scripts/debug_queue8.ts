
import { databasePool } from '../src/db/pool';
import { RouterOSAPI } from 'node-routeros';
import { syncClientQueues } from '../src/services/staticIpPackageService'; // Assuming this service exists to decouple logic

async function debugQueue8() {
    console.log("=== DEBUGGING QUEUE8 ===");
    try {
        // 1. Get Config
        const [settings] = await databasePool.query<any[]>('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
        const config = settings[0];
        console.log(`📡 Connecting to MikroTik ${config.host} as ${config.username}...`);

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 10000
        });

        await api.connect();
        console.log("✅ Custom MikroTik Connected.");

        // 2. Locate 'queue8' in MikroTik
        console.log("🔍 Checking MikroTik for 'queue8'...");
        const queues = await api.write('/queue/tree/print', ['?name=queue8']);
        if (queues.length === 0) {
            console.error("❌ 'queue8' NOT FOUND in MikroTik Queue Tree.");
            // Check Simple Queue
            const sq = await api.write('/queue/simple/print', ['?name=queue8']);
            if (sq.length > 0) {
                console.log("⚠️ Found 'queue8' in Simple Queues:", sq[0]);
            }
        } else {
            console.log("✅ Found 'queue8' in Queue Tree:", queues[0]);
        }

        // 3. Find Customer tied to queue8 in DB
        // Assuming queue8 matches a name or client_name
        console.log("🔍 searching DB for customer matching 'queue8'...");
        const [cust] = await databasePool.query<any[]>('SELECT * FROM customers WHERE name = ?', ['queue8']);
        const [staticClient] = await databasePool.query<any[]>('SELECT * FROM static_ip_clients WHERE client_name = ?', ['queue8']);

        let customerData = null;
        if (cust.length > 0) {
            console.log("✅ Customer found in 'customers' table:", cust[0]);
            customerData = cust[0];
        } else {
            console.log("❌ Customer 'queue8' NOT found in 'customers' table.");
        }

        if (staticClient.length > 0) {
            console.log("✅ Client found in 'static_ip_clients' table:", staticClient[0]);
        } else {
            console.log("❌ Client 'queue8' NOT found in 'static_ip_clients' table.");
        }

        // 4. Force Update / Test Move Package
        if (customerData) {
            console.log("🔄 ATTEMPTING TO MOVE PACKAGE...");
            // Find "PAKET TESTING" Package
            const [pkg] = await databasePool.query<any[]>('SELECT * FROM static_ip_packages WHERE name LIKE ? LIMIT 1', ['PAKET TESTING']);

            if (pkg.length > 0) {
                console.log(`✅ Target Package Found: ${pkg[0].name} (ID: ${pkg[0].id})`);
                console.log(`   max_limit_download: ${pkg[0].max_limit_download}`);
                console.log(`   child_download_limit: ${pkg[0].child_download_limit}`);
                console.log(`   limit_at_download: ${pkg[0].limit_at_download}`);
                console.log(`   child_limit_at_download: ${pkg[0].child_limit_at_download}`);

                // Update DB
                await databasePool.query('UPDATE customers SET connection_type = "static_ip" WHERE id = ?', [customerData.id]);
                // Update or Create Static Client
                if (staticClient.length > 0) {
                    await databasePool.query('UPDATE static_ip_clients SET package_id = ?, ip_address = ? WHERE id = ?',
                        [pkg[0].id, customerData.ip_address || '192.168.30.30', staticClient[0].id]);
                } else {
                    await databasePool.query('INSERT INTO static_ip_clients (customer_id, package_id, client_name, ip_address, status) VALUES (?, ?, ?, ?, ?)',
                        [customerData.id, pkg[0].id, 'queue8', customerData.ip_address || '192.168.30.30', 'active']);
                }

                console.log("🔄 Triggering Sync Logic...");
                // Simulate controller logic
                await syncClientQueues(
                    customerData.id,
                    pkg[0].id,
                    customerData.ip_address || '192.168.30.30',
                    'queue8'
                );
                console.log("✅ Sync command executed.");

                // 5. Verify Change
                console.log("🔍 Re-checking MikroTik for 'queue8'...");
                const queuesAfter = await api.write('/queue/tree/print', ['?name=queue8']);
                if (queuesAfter.length > 0) {
                    const q = queuesAfter[0];
                    console.log("✅ Queue Details After Sync:", q);
                    if (q.parent === pkg[0].name || q['max-limit'] === pkg[0].max_limit_download) { // Checking mostly parent or limits
                        console.log("🎉 SUCCESS: Queue moved/updated correctly!");
                    } else {
                        console.log("⚠️ WARNING: Queue details might not match target package yet.");
                        console.log(`   Expected Parent: ${pkg[0].name}`);
                        console.log(`   Expected Limit: ${pkg[0].max_limit_download}`);
                    }
                }

            } else {
                console.error("❌ Package 'Dedicated 10Mbps' not found in DB. Cannot test move.");
            }
        } else {
            // Create Dummy for testing if requested
            console.log("🛠️ Creating Dummy 'queue8' to test...");
            const [pkg] = await databasePool.query<any[]>('SELECT * FROM static_ip_packages LIMIT 1'); // Pick any
            const [res] = await databasePool.query<any>('INSERT INTO customers (name, ip_address, connection_type, status) VALUES (?, ?, ?, ?)',
                ['queue8', '192.168.30.30', 'static_ip', 'active']);

            await databasePool.query('INSERT INTO static_ip_clients (customer_id, package_id, client_name, ip_address, status) VALUES (?, ?, ?, ?, ?)',
                [res.insertId, pkg[0].id, 'queue8', '192.168.30.30', 'active']);

            console.log("✅ Dummy 'queue8' created. Re-run script to sync.");
        }

        await api.close();

    } catch (e: any) {
        console.error("❌ ERROR:", e);
    } finally {
        process.exit();
    }
}

debugQueue8();
