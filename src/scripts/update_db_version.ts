
import { databasePool } from '../db/pool';

async function updateVersion() {
    try {
        console.log('Updating app_version in system_settings...');
        await databasePool.query(
            "UPDATE system_settings SET setting_value = '2.1.30' WHERE setting_key = 'app_version'"
        );
        console.log('Update complete.');

        const [rows] = await databasePool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'app_version'");
        console.log('New version in DB:', (rows as any)[0].setting_value);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

updateVersion();
