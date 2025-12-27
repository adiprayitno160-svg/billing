"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
async function updateVersion() {
    try {
        console.log('Updating app_version in system_settings...');
        await pool_1.databasePool.query("UPDATE system_settings SET setting_value = '2.1.30' WHERE setting_key = 'app_version'");
        console.log('Update complete.');
        const [rows] = await pool_1.databasePool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'app_version'");
        console.log('New version in DB:', rows[0].setting_value);
        process.exit(0);
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
}
updateVersion();
//# sourceMappingURL=update_db_version.js.map