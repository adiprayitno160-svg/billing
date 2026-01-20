
import { databasePool } from '../db/pool';

async function checkTables() {
    try {
        const [tables] = await databasePool.query('SHOW TABLES');
        console.log('Tables:', JSON.stringify(tables, null, 2));

        const [networkDevices] = await databasePool.query("SHOW COLUMNS FROM network_devices");
        console.log('network_devices columns:', JSON.stringify(networkDevices, null, 2));

        const [rows] = await databasePool.query("SELECT COUNT(*) as count FROM network_devices");
        console.log('network_devices row count:', rows);

        const [networkLinks] = await databasePool.query("SHOW COLUMNS FROM network_links");
        console.log('network_links columns:', JSON.stringify(networkLinks, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkTables();
