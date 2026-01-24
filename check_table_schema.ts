
import { databasePool } from './src/db/pool';

async function checkSchema() {
    try {
        console.log('--- subscriptions ---');
        const [subRows] = await databasePool.query("DESCRIBE subscriptions");
        console.table(subRows);

        console.log('--- static_ip_clients ---');
        const [sicRows] = await databasePool.query("DESCRIBE static_ip_clients");
        console.table(sicRows);

        console.log('--- static_ip_packages ---');
        const [sipRows] = await databasePool.query("DESCRIBE static_ip_packages");
        console.table(sipRows);

    } catch (error: any) {
        console.error('Check failed:', error.message);
    } finally {
        process.exit(0);
    }
}

checkSchema();
