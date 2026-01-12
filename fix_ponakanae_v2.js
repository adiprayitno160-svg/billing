
const mysql = require('mysql2/promise');
const RouterOSAPI = require('node-routeros').RouterOSAPI;
require('dotenv').config();

async function run() {
    console.log("=== STARTING DIRECT FIX FOR PONAKANAE KEVIN (V2) ===");

    // 1. Connect to DB
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    // 2. Get Customer & IP
    const [custRows] = await conn.execute('SELECT * FROM customers WHERE name LIKE "%Ponakanae%"');
    const customer = custRows[0];
    if (!customer) { console.error("❌ Customer 'Ponakanae' not found"); process.exit(1); }

    // Check static_ip_clients if main IP is null
    let ipToUse = customer.ip_address;
    if (!ipToUse) {
        console.log("⚠️ Main customer IP is null, checking static_ip_clients...");
        const [sicRows] = await conn.execute('SELECT * FROM static_ip_clients WHERE customer_id = ?', [customer.id]);
        if (sicRows.length > 0) {
            ipToUse = sicRows[0].ip_address;
            console.log(`✅ Found IP in static_ip_clients: ${ipToUse}`);
        }
    }

    // Fallback if still null (hardcode from user request)
    if (!ipToUse) {
        console.log("⚠️ IP still null, using hardcoded fallback from user request: 192.168.5.2");
        ipToUse = "192.168.5.2";
    }

    console.log(`✅ Using IP: ${ipToUse}`);

    // 3. Get MikroTik Config
    const [mtRows] = await conn.execute('SELECT * FROM mikrotik_settings LIMIT 1');
    const mtConfig = mtRows[0];

    // 4. Get Target Package
    const [pkgRows] = await conn.execute("SELECT * FROM static_ip_packages WHERE name LIKE '%110%'");
    const pkg = pkgRows[0];
    if (!pkg) process.exit(1);

    // 5. Connect
    const client = new RouterOSAPI({
        host: mtConfig.host,
        port: mtConfig.port,
        user: mtConfig.username,
        password: mtConfig.password,
        timeout: 10000
    });

    try {
        await client.connect();
        console.log("✅ Connected to RouterOS");

        const queues = await client.write('/queue/tree/print');

        // Find Parent
        let parentName = '';
        const strictParent = `${pkg.name}_DOWNLOAD`; // e.g. PAKET 110_DOWNLOAD

        // Robust Parent Find: Look for package name in parent queues
        const fuzzyParent = queues.find(q =>
            q.name.toLowerCase().includes('110') &&
            q.name.toUpperCase().includes('DOWNLOAD')
        );

        if (fuzzyParent) {
            console.log(`✅ Found Fuzzy Parent: ${fuzzyParent.name}`);
            parentName = fuzzyParent.name;
        } else {
            // Try strict
            console.log(`⚠️ Fuzzy parent not found. Trying strict: ${strictParent}`);
            parentName = strictParent;
        }

        // Find Client Queue
        const customerName = customer.name;
        const cleanIp = ipToUse.split('/')[0];

        // Search logic
        let targetQueue = queues.find(q => q.name === customerName); // "Ponakanae kevin"
        if (!targetQueue) {
            targetQueue = queues.find(q => q['packet-mark'] === cleanIp);
        }
        if (!targetQueue) {
            // Try finding by name with underscores?
            targetQueue = queues.find(q => q.name.includes('Ponakanae'));
        }

        if (targetQueue) {
            console.log(`✅ FOUND TARGET QUEUE! ID: ${targetQueue['.id']} Name: ${targetQueue.name} Parent: ${targetQueue.parent}`);
            // If parent is different OR limit is different, update it
            if (targetQueue.parent !== parentName || targetQueue['max-limit'] !== pkg.max_limit_download) {
                console.log("⚡ Queue needs update!");

                const newMark = `${customerName.replace(/ /g, '_')}_DL_MARK`;

                await client.write('/queue/tree/set', [
                    `=.id=${targetQueue['.id']}`,
                    `=parent=${parentName}`,
                    `=max-limit=${pkg.max_limit_download}`,
                    `=packet-mark=${newMark}`,
                    `=comment=[BILLING] DL for ${customerName}`
                ]);
                console.log("✅ QUEUE UPDATED");

                // Update Mangle
                console.log("🔧 Updating Mangles...");
                // Find old mangles by IP
                const oldMangles = await client.write('/ip/firewall/mangle/print', [`?dst-address=${cleanIp}`]);
                for (const m of oldMangles) {
                    await client.write('/ip/firewall/mangle/remove', [`=.id=${m['.id']}`]);
                }

                // Add new
                await client.write('/ip/firewall/mangle/add', [
                    `=chain=forward`,
                    `=dst-address=${cleanIp}`,
                    `=action=mark-packet`,
                    `=new-packet-mark=${newMark}`,
                    `=comment=Download for ${customerName}`
                ]);
                console.log("✅ Mangle Updated");

            } else {
                console.log("queue is already correct.");
            }
        } else {
            console.error("❌ Queue not found in MikroTik.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.close();
        conn.end();
    }
}

run();
