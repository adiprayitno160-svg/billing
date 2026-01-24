
import { databasePool } from '../src/db/pool';

async function dump() {
    try {
        const [pkg] = await databasePool.query<any[]>('SELECT * FROM static_ip_packages WHERE id = 23');
        console.log(JSON.stringify(pkg[0], null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
dump();
