import { databasePool } from './src/db/pool';
import { getMikrotikConfig } from './src/services/pppoeService';
import { getPppoeActiveConnections } from './src/services/mikrotikService';

(async () => {
    try {
        const [rows] = await databasePool.query(`SELECT id, name, pppoe_username, connection_type, status, is_isolated FROM customers WHERE name LIKE '%dimas%' OR name LIKE '%huafi%'`);
        console.log("DB RESULT:", rows);

        const config = await getMikrotikConfig();
        if (config) {
            const sessions = await getPppoeActiveConnections(config);
            const matches = sessions.filter((s: any) => s.name && (s.name.toLowerCase().includes('dimas') || s.name.toLowerCase().includes('huafi')));
            console.log("Mikrotik Session Matches:", matches);
        } else {
            console.log("No Mikrotik config found.");
        }
    } catch(e) {
        console.error(e);
    } finally {
        process.exit();
    }
})();
