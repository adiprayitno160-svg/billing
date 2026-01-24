
import { databasePool } from './src/db/pool';

async function checkPackages() {
    console.log('Checking Static IP Packages...');
    try {
        const [rows] = await databasePool.query("SELECT id, name, price, description FROM static_ip_packages");
        console.table(rows);
    } catch (error: any) {
        console.error('Check failed:', error.message);
    } finally {
        process.exit(0);
    }
}

checkPackages();
