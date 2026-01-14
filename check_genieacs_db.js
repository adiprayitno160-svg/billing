
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkGenieacsSettings() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [rows] = await conn.execute("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'genieacs_%'");
        console.log('Current GenieACS Settings in DB:');
        console.table(rows);
        await conn.end();
    } catch (e) {
        console.error(e);
    }
}

checkGenieacsSettings();
