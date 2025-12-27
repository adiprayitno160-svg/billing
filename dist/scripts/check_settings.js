"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
async function checkSettings() {
    try {
        const [rows] = await pool_1.databasePool.query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('app_version', 'github_repo_owner', 'github_repo_name')");
        console.log('Settings:', rows);
        process.exit(0);
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkSettings();
//# sourceMappingURL=check_settings.js.map