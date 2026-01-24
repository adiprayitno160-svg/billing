
import { databasePool } from '../src/db/pool';

async function createDummy() {
    try {
        console.log("=== CREATING DUMMY DATA FOR ADI SAWO ===");

        // 1. Get a valid Package ID
        const [packages] = await databasePool.query<any[]>('SELECT id, name FROM static_ip_packages LIMIT 1');

        let packageId: number;
        if (packages.length > 0) {
            packageId = packages[0].id;
            console.log(`✅ Using existing package: [${packageId}] ${packages[0].name}`);
        } else {
            console.log("⚠️ No static IP packages found. Creating a default '50K' package...");
            const [res] = await databasePool.query<any>(`
                INSERT INTO static_ip_packages (name, price, duration_days, status, max_limit_upload, max_limit_download, max_clients) 
                VALUES ('50K', 50000, 30, 'active', '1M', '2M', 1)
            `);
            packageId = res.insertId;
            console.log(`✅ Created package '50K' with ID: ${packageId}`);
        }

        // 2. Insert Customer
        const customerData = {
            name: 'ADI SAWO',
            phone: '08123456789', // Dummy phone
            address: 'Dusun Sawo', // Dummy address context
            status: 'active',
            connection_type: 'static_ip',
            ip_address: '192.168.238.38', // MATCHING MIKROTIK
            created_at: new Date(),
            updated_at: new Date()
        };

        // Check if exists first to avoid dupes (though previous check said no)
        const [existing] = await databasePool.query<any[]>('SELECT id FROM customers WHERE name = ?', [customerData.name]);

        let customerId: number;
        if (existing.length > 0) {
            customerId = existing[0].id;
            console.log(`⚠️ Customer 'ADI SAWO' already exists with ID: ${customerId}. Updating IP...`);
            await databasePool.query('UPDATE customers SET ip_address = ?, connection_type = ? WHERE id = ?', [customerData.ip_address, 'static_ip', customerId]);
        } else {
            const [custRes] = await databasePool.query<any>('INSERT INTO customers SET ?', customerData);
            customerId = custRes.insertId;
            console.log(`✅ Created customer 'ADI SAWO' with ID: ${customerId}`);
        }

        // 3. Insert/Update Static IP Client Record (Important for syncing!)
        const [staticClient] = await databasePool.query<any[]>('SELECT id FROM static_ip_clients WHERE customer_id = ?', [customerId]);

        if (staticClient.length > 0) {
            console.log(`⚠️ Static IP Client record exists. Updating...`);
            await databasePool.query('UPDATE static_ip_clients SET ip_address = ?, package_id = ? WHERE id = ?',
                [customerData.ip_address, packageId, staticClient[0].id]);
        } else {
            console.log(`✅ Creating Static IP Client record...`);
            await databasePool.query(`
                INSERT INTO static_ip_clients (customer_id, package_id, client_name, ip_address, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'active', NOW(), NOW())
             `, [customerId, packageId, customerData.name, customerData.ip_address]);
        }

        console.log("\n✅ DUMMY DATA CREATION SUCCESSFUL!");
        console.log("👉 You can now edit 'ADI SAWO' in the Billing Dashboard.");

    } catch (e) {
        console.error("❌ ERROR:", e);
    } finally {
        process.exit();
    }
}

createDummy();
