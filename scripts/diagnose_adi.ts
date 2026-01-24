
import { databasePool } from '../src/db/pool';
import { RouterOSAPI } from 'node-routeros';

async function diagnose() {
    try {
        console.log("=== DIAGNOSIS FOR ADI SAWO ===");

        // 1. Check DB for Customer
        console.log("🔍 [DB] Searching for 'ADI', 'SAWO', or IP '192.168.239.38'...");
        const [customers] = await databasePool.query<any[]>('SELECT * FROM customers WHERE name LIKE ? OR name LIKE ? OR ip_address LIKE ?', ['%ADI%', '%SAWO%', '%192.168.239.38%']);

        // Also check static_ip_clients
        const [staticClients] = await databasePool.query<any[]>('SELECT * FROM static_ip_clients WHERE ip_address LIKE ? OR client_name LIKE ?', ['%192.168.239.38%', '%ADI%']);

        let customer = null;

        if (customers.length === 0 && staticClients.length === 0) {
            console.error("❌ [DB] No customers found matching Name or IP in DB.");
        } else {
            console.log(`✅ [DB] Found matches!`);
            customers.forEach(c => console.log(`   [Customer Table] ID: ${c.id}, Name: "${c.name}", PPPoE User: "${c.pppoe_username}", IP: "${c.ip_address}"`));
            staticClients.forEach(c => console.log(`   [Static IP Table] ID: ${c.id}, Client Name: "${c.client_name}", IP: "${c.ip_address}"`));
        }

        console.log("\n---------------------------------------------------");

        // 4. Check MikroTik directly (ALWAYS RUN THIS)
        console.log("📡 Connecting to MikroTik to verify actual state...");
        const [settings] = await databasePool.query<any[]>('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
        if (!settings.length) {
            console.error("❌ No MikroTik configuration in DB.");
            process.exit(1);
        }
        const config = settings[0];

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 10000
        });

        try {
            await api.connect();
            console.log("✅ Connected to MikroTik.");

            // Check Queue Tree for ADI SAWO
            console.log(`🔍 [MT] Checking /queue/tree for name="ADI SAWO"`);
            const queues = await api.write('/queue/tree/print', ['?name=ADI SAWO']);
            if (queues.length > 0) {
                console.log("✅ Queue Tree Found:");
                console.log(JSON.stringify(queues[0], null, 2));
            } else {
                console.log("❌ Queue Tree 'ADI SAWO' NOT FOUND.");
            }

            // Check Queue Tree by Packet Mark (IP from screenshot)
            // Note: In screenshot, packet mark is "192.168.239.38" IF using mangle-based queues
            console.log(`🔍 [MT] Checking /queue/tree for packet-mark="192.168.240.94"`); // Start matching screenshot IPs
            // Wait, looking closely at screenshot:
            // "ADI SAWO" -> 50K -> 192.168.240.94 (Packet Marks)
            // Row below: "IIN SAWO" -> 192.168.240.94?? No.
            // Let's re-read screenshot.
            // ADI SAWO: Packet Marks = 192.168.240.94
            // Wait, "IIN SAWO" is below it.
            // ADI SAWO is 192.168.240.94 (Wait, the screenshot has many lines).
            // Line: ADI SAWO, Parent: 50K, Packet Marks: 192.168.240.94

            // Ah, I misread "38" earlier, that was "ADIKE MBAK MUS".
            // ADI SAWO is 192.168.240.94

            const targetIp = "192.168.240.94";
            console.log(`🔍 [MT] Checking /queue/tree for packet-mark="${targetIp}"`);
            const queuesByMark = await api.write('/queue/tree/print', [`?packet-mark=${targetIp}`]);
            if (queuesByMark.length > 0) {
                console.log("✅ Queue Tree Found by Mark:");
                queuesByMark.forEach(q => console.log(`   Name: ${q.name}, Parent: ${q.parent}, MaxLimit: ${q['max-limit']}`));
            }

            // Check Simple Queue just in case
            console.log(`🔍 [MT] Checking /queue/simple for name="ADI SAWO"`);
            const simpleQueues = await api.write('/queue/simple/print', ['?name=ADI SAWO']);
            if (simpleQueues.length > 0) {
                console.log("✅ Simple Queue Found:");
                console.log(JSON.stringify(simpleQueues[0], null, 2));
            }

            await api.close();

        } catch (err: any) {
            console.error("MikroTik Error:", err.message);
        }

    } catch (e) {
        console.error("GLOBAL ERROR:", e);
    } finally {
        process.exit();
    }
}

diagnose();
