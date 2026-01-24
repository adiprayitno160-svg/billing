
import { databasePool } from '../src/db/pool';

async function dump() {
    try {
        const [pkgs] = await databasePool.query<any[]>('SELECT * FROM static_ip_packages');
        console.log("=== ALL STATIC IP PACKAGES ===");
        pkgs.forEach(p => {
            console.log(`ID: ${p.id}, Name: "${p.name}", ParentUP: ${p.parent_upload_name}, ParentDown: ${p.parent_download_name}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
dump();
