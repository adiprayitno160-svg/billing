
const { databasePool } = require('./dist/db/pool');

async function run() {
    try {
        console.log("Verifying 'Monitor Pelanggan Trouble' logic...");

        // This query replicates the logic in NetworkMonitoringService.getTroubleCustomers for Static IP Offline
        const query = `
            SELECT DISTINCT
                c.id, c.name, c.customer_code, c.status, c.connection_type,
                'Offline' as issue_type,
                sips.status as ping_status,
                sips.last_check
            FROM customers c
            INNER JOIN static_ip_ping_status sips ON c.id = sips.customer_id
            WHERE c.connection_type = 'static_ip'
                AND sips.status = 'offline'
                AND c.status IN ('active', 'suspended')
                AND sips.last_check >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        `;

        const [rows] = await databasePool.query(query);

        console.log(`Found ${rows.length} troubled static IP customers.`);
        rows.forEach(r => {
            console.log(`- [${r.id}] ${r.name} (${r.customer_code}): Status=${r.ping_status}, LastCheck=${r.last_check}`);
        });

        const kevin = rows.find(r => r.name.toLowerCase().includes('ponakanae kevin'));
        if (kevin) {
            console.log("SUCCESS: 'Ponakanae Kevin' is detected as troubled!");
        } else {
            console.log("FAILURE: 'Ponakanae Kevin' is NOT detected as troubled.");
        }

    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

run();
