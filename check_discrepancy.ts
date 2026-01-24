
import { databasePool } from './src/db/pool';

async function checkDiscrepancy() {
    try {
        // Get all static IP packages
        const [packages] = await databasePool.query("SELECT * FROM static_ip_packages");
        const staticPackages = packages as any[];
        console.log(`Found ${staticPackages.length} static IP packages.`);

        // Get all subscriptions
        const [subs] = await databasePool.query("SELECT * FROM subscriptions WHERE status = 'active'");
        const subscriptions = subs as any[];
        console.log(`Found ${subscriptions.length} active subscriptions.`);

        console.log('\n--- Discrepancy Check ---');
        let found = false;

        // Check match by name (assuming package_name in subscriptions matches name in static_ip_packages)
        for (const sub of subscriptions) {
            // Find matching static IP package
            const pkg = staticPackages.find(p => p.name === sub.package_name);

            if (pkg) {
                const subPrice = Number(sub.price);
                const pkgPrice = Number(pkg.price);

                if (subPrice !== pkgPrice) {
                    console.log(`MISMATCH: Subscription #${sub.id} (Customer ${sub.customer_id})`);
                    console.log(`  Package: ${sub.package_name}`);
                    console.log(`  Subscription Price: ${subPrice}`);
                    console.log(`  Current Package Price: ${pkgPrice}`);
                    console.log('-------------------------------------------');
                    found = true;
                }
            }
        }

        if (!found) {
            console.log("No price discrepancies found between active subscriptions and static IP packages (matched by name).");
        }

    } catch (error: any) {
        console.error('Check failed:', error.message);
    } finally {
        process.exit(0);
    }
}

checkDiscrepancy();
