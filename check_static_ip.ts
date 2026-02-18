
import { databasePool } from './src/db/pool';
async function test() {
    try {
        const [pkgs] = await databasePool.query("SELECT id, name, max_limit_upload, max_limit_download, max_clients FROM static_ip_packages");
        console.log('Packages:', pkgs);
        const [clients] = await databasePool.query("SELECT id, client_name, ip_address, package_id FROM static_ip_clients LIMIT 5");
        console.log('Clients:', clients);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
