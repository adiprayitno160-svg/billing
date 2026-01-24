
import { databasePool } from '../src/db/pool';

async function dump() {
    try {
        const [pkg] = await databasePool.query<any[]>('SELECT * FROM static_ip_packages WHERE name LIKE ?', ['Dedicated 10Mbps']);
        console.log(JSON.stringify(pkg, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
dump();
