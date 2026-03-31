
import { databasePool } from '../src/db/pool';

async function fix() {
    try {
        console.log("Fixing package 23 burst values...");
        await databasePool.query('UPDATE static_ip_packages SET child_burst_upload = NULL, child_burst_download = NULL WHERE id = 23');
        console.log("✅ Fixed.");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
fix();
