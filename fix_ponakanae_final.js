
const mysql = require('mysql2/promise');
const RouterOSAPI = require('node-routeros').RouterOSAPI;
require('dotenv').config();

async function run() {
    console.log("=== FINAL FIX FOR CUSTOMER 87 (PONAKANAE KEVIN) ===");

    // 1. Connect DB
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    // 2. Target Customer 87
    const targetId = 87;
    const [custRows] = await conn.execute('SELECT * FROM customers WHERE id = ?', [targetId]);
    const customer = custRows[0];
    if (!customer) { console.error("❌ Customer 87 not found"); process.exit(1); }
    console.log(`✅ Customer 87 Found: ${customer.name}`);

    // Update DB IP to correct one if wrong
    const correctedIp = "192.168.5.2";
    if (customer.ip_address !== correctedIp) {
        console.log(`⚠️ Customer Main IP is ${customer.ip_address}, updating to ${correctedIp}`);
        await conn.execute('UPDATE customers SET ip_address = ? WHERE id = ?', [correctedIp, targetId]);
    }

    // Update Static IP Client table too
    const [sicRows] = await conn.execute('SELECT * FROM static_ip_clients WHERE customer_id = ?', [targetId]);
    if (sicRows.length > 0) {
        if (sicRows[0].ip_address !== correctedIp) {
            console.log(`⚠️ Static IP Client IP is ${sicRows[0].ip_address}, updating...`);
            await conn.execute('UPDATE static_ip_clients SET ip_address = ? WHERE id = ?', [correctedIp, sicRows[0].id]);
        }
    } else {
        console.log("Creating static_ip_client record...");
        await conn.execute("INSERT INTO static_ip_clients (customer_id, client_name, ip_address, status, created_at) VALUES (?, ?, ?, 'active', NOW())", [targetId, customer.name, correctedIp]);
    }

    // 3. MikroTik Config
    const [mtRows] = await conn.execute('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
    const mtConfig = mtRows[0];

    // 4. Target Package (PAKET 110)
    const [pkgRows] = await conn.execute("SELECT * FROM static_ip_packages WHERE name LIKE '%110%'");
    const pkg = pkgRows[0];
    if (!pkg) process.exit(1);

    // 5. Connect MikroTik
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
        let parentName = `${pkg.name}_DOWNLOAD`;
        const fuzzyParent = queues.find(q => q.name.includes('110') && q.name.includes('DOWNLOAD'));
        if (fuzzyParent) parentName = fuzzyParent.name;
        console.log(`Using Parent: ${parentName}`);

        // Find Target Queue by Name (Ponakanae kevin) or IP 5.2
        const searchName = customer.name;
        const searchIp = correctedIp;

        console.log(`Searching for queue: Name='${searchName}' OR Mark='${searchIp}'`);

        let targetQueue = queues.find(q => q.name === searchName);
        if (!targetQueue) targetQueue = queues.find(q => q['packet-mark'] === searchIp);

        // Also check if there is a 'duplicate' queue for ID 52 (if names are identical)
        // If we find multiple, we might need to act carefully.
        const candidates = queues.filter(q => q.name.includes('Ponakanae'));
        console.log(`Found ${candidates.length} candidates with name 'Ponakanae':`, candidates.map(c => c.name));

        if (targetQueue) {
            console.log(`✅ Updating Target Queue: ${targetQueue.name} (ID: ${targetQueue['.id']})`);

            const newMark = `${searchName.replace(/\s+/g, '_')}_DL_MARK`;

            await client.write('/queue/tree/set', [
                `=.id=${targetQueue['.id']}`,
                `=parent=${parentName}`,
                `=max-limit=${pkg.max_limit_download}`,
                `=packet-mark=${newMark}`,
                `=comment=[BILLING] DL for ${searchName} (ID: 87)`
            ]);
            console.log("✅ Queue Updated.");

            // Fix Mangles
            const oldMangles = await client.write('/ip/firewall/mangle/print', [`?dst-address=${searchIp}`]);
            for (const m of oldMangles) {
                await client.write('/ip/firewall/mangle/remove', [`=.id=${m['.id']}`]);
            }

            await client.write('/ip/firewall/mangle/add', [
                `=chain=forward`,
                `=dst-address=${searchIp}`,
                `=action=mark-packet`,
                `=new-packet-mark=${newMark}`,
                `=comment=Download for ${searchName}`
            ]);
            console.log("✅ Mangle Updated.");

        } else {
            console.error("❌ Queue not found. Creating...");
            // logic to create if needed
        }

    } catch (e) {
        console.error("MikroTik Error:", e);
    } finally {
        client.close();
        conn.end();
    }
}
run();
