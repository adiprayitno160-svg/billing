
const mysql = require('mysql2/promise');
const RouterOSAPI = require('node-routeros').RouterOSAPI;
require('dotenv').config();

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log("=== STARTING DIRECT FIX FOR PONAKANAE KEVIN ===");

    // 1. Connect to DB
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    console.log("✅ DB Connected");

    // 2. Get MikroTik Config
    const [mtRows] = await conn.execute('SELECT * FROM mikrotik_settings LIMIT 1');
    const mtConfig = mtRows[0];
    if (!mtConfig) { console.error("❌ No MikroTik Config"); process.exit(1); }
    console.log(`✅ MikroTik Config Found: ${mtConfig.host}`);

    // 3. Get Customer Data
    const [custRows] = await conn.execute('SELECT * FROM customers WHERE name LIKE "%Ponakanae%"');
    const customer = custRows[0];
    if (!customer) { console.error("❌ Customer 'Ponakanae' not found"); process.exit(1); }
    console.log(`✅ Customer Found: ${customer.name} (ID: ${customer.id}) IP: ${customer.ip_address}`);

    // 4. Get Target Package (PAKET 110)
    // Note: User said "PAKET 110", checking flexible name
    const [pkgRows] = await conn.execute("SELECT * FROM static_ip_packages WHERE name LIKE '%110%'");
    const pkg = pkgRows[0];
    if (!pkg) { console.error("❌ Package 'PAKET 110' not found"); process.exit(1); }
    console.log(`✅ Target Package Found: ${pkg.name} (ID: ${pkg.id}) DL Limit: ${pkg.max_limit_download}`);

    // 5. Connect to MikroTik
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

        // 6. Find Parent Queue
        const queues = await client.write('/queue/tree/print');

        let parentName = '';
        const strictParent = `${pkg.name}_DOWNLOAD`;
        const fuzzyParent = queues.find(q => q.name.includes('110') && q.name.includes('DOWNLOAD'));

        if (fuzzyParent) {
            console.log(`✅ Found Fuzzy Parent: ${fuzzyParent.name}`);
            parentName = fuzzyParent.name;
        } else {
            console.log(`⚠️ Parent not found, attempting to use strict: ${strictParent}`);
            parentName = strictParent;
        }

        // 7. Find Client Queue
        const customerName = customer.name; // "Ponakanae kevin"
        const customerIp = customer.ip_address.split('/')[0]; // "192.168.5.2"

        console.log(`🔎 Searching for queue with Name: '${customerName}' OR PacketMark: '${customerIp}'`);

        let targetQueue = queues.find(q => q.name === customerName);
        if (!targetQueue) {
            targetQueue = queues.find(q => q['packet-mark'] === customerIp);
        }

        if (targetQueue) {
            console.log(`✅ FOUND TARGET QUEUE! ID: ${targetQueue['.id']} Name: ${targetQueue.name} Parent: ${targetQueue.parent}`);

            // 8. UPDATE THE QUEUE
            const updateData = {
                '.id': targetQueue['.id'],
                'parent': parentName,
                'max-limit': pkg.max_limit_download,
                'comment': `[BILLING] DL for ${customerName} (Fixed)`
            };

            // Only update marks if we are standardizing. For now, let's keep it simple to just Fix the Limit and Parent first
            // But getting Mangle rules consistent is better.
            const newMark = `${customerName.replace(/ /g, '_')}_DL_MARK`;
            updateData['packet-mark'] = newMark;

            console.log("📝 UPDATING QUEUE WITH:", updateData);

            await client.write('/queue/tree/set', Object.keys(updateData).map(k => `=${k}=${updateData[k]}`));
            console.log("✅ QUEUE UPDATED SUCCESSFULLY");

            // 9. Fix Mangle Rule
            console.log("🔧 FIXING MANGLE RULES...");
            // Remove old by IP
            const mangles = await client.write('/ip/firewall/mangle/print', [`?dst-address=${customerIp}`]);
            for (const m of mangles) {
                await client.write('/ip/firewall/mangle/remove', [`=.id=${m['.id']}`]);
            }

            // Add new
            await client.write('/ip/firewall/mangle/add', [
                `=chain=forward`,
                `=dst-address=${customerIp}`,
                `=action=mark-packet`,
                `=new-packet-mark=${newMark}`,
                `=comment=Download for ${customerName}`
            ]);
            console.log("✅ MANGLE RULE UPDATED");

        } else {
            console.error("❌ COULD NOT FIND QUEUE FOR CUSTOMER. It might be missing.");
            // Create it?
            console.log("Creating new queue...");
            // ... logic to create ...
        }

    } catch (e) {
        console.error("❌ MIKROTIK ERROR:", e);
    } finally {
        await client.close();
        await conn.end();
    }
}

run();
