
import { databasePool } from './src/db/pool';

async function reproduce() {
    try {
        console.log('--- Reproduction Start ---');
        const conn = await databasePool.getConnection();

        // 1. Create Package A at 100,000
        const [pkgRes] = await conn.execute(
            "INSERT INTO static_ip_packages (name, max_limit_upload, max_limit_download, price, status) VALUES (?, ?, ?, ?, ?)",
            ['Package A', '1M', '1M', 100000, 'active']
        );
        const packageId = (pkgRes as any).insertId;
        console.log(`Created Package A (ID: ${packageId}) with price 100,000`);

        // 2. Create Subscription at 100,000 (simulating customer creation)
        const [custRes] = await conn.execute(
            "INSERT INTO customers (name, customer_code) VALUES (?, ?)",
            ['Test Customer', 'TEST001']
        );
        const customerId = (custRes as any).insertId;

        await conn.execute(
            "INSERT INTO subscriptions (customer_id, package_id, package_name, price, status, start_date) VALUES (?, ?, ?, ?, ?, NOW())",
            [customerId, packageId, 'Package A', 100000, 'active']
        );
        console.log(`Created Subscription for Package A with price 100,000`);

        // 3. Update Package A to 110,000
        await conn.execute(
            "UPDATE static_ip_packages SET price = ? WHERE id = ?",
            [110000, packageId]
        );
        console.log(`Updated Package A price to 110,000`);

        // 4. Check Discrepancy
        const [subRows] = await conn.query("SELECT * FROM subscriptions WHERE customer_id = ?", [customerId]);
        const sub = (subRows as any)[0];
        console.log(`Subscription Price is now: ${sub.price}`);

        if (Number(sub.price) === 100000) {
            console.log('SUCCESS: Reproduced the discrepancy! Subscription price remained 100,000 after package update.');
        } else {
            console.log('FAILED: Subscription price updated? That is unexpected.');
        }

        // Cleanup
        await conn.execute("DELETE FROM subscriptions WHERE customer_id = ?", [customerId]);
        await conn.execute("DELETE FROM customers WHERE id = ?", [customerId]);
        await conn.execute("DELETE FROM static_ip_packages WHERE id = ?", [packageId]);
        console.log('Cleanup done.');

        conn.release();

    } catch (error: any) {
        console.error('Reproduction failed:', error);
    } finally {
        process.exit(0);
    }
}

reproduce();
