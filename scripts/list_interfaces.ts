
import { databasePool } from '../src/db/pool';
import { RouterOSAPI } from 'node-routeros';

async function listInterfaces() {
    try {
        const [settings] = await databasePool.query<any[]>('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
        const config = settings[0];

        const api = new RouterOSAPI({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            timeout: 10000
        });

        await api.connect();
        const interfaces = await api.write('/interface/print');
        console.log("=== INTERFACES ===");
        interfaces.forEach(i => console.log(`${i.name} (${i.type})`));
        await api.close();
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
listInterfaces();
