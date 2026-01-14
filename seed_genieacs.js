
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedGenieacs() {
    console.log('🌱 Seeding GenieACS Settings...');
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        // Use INSERT ... ON DUPLICATE KEY UPDATE to ensure values exist
        // Note: I am setting the category to 'genieacs' so it shows up in the dynamic loop
        const queries = [
            `INSERT INTO system_settings (setting_key, setting_value, setting_description, category) VALUES ('genieacs_host', '192.168.239.154', 'IP Address server GenieACS', 'genieacs') ON DUPLICATE KEY UPDATE category='genieacs'`,
            `INSERT INTO system_settings (setting_key, setting_value, setting_description, category) VALUES ('genieacs_port', '7557', 'Port API GenieACS', 'genieacs') ON DUPLICATE KEY UPDATE category='genieacs'`
        ];

        for (const q of queries) {
            await conn.execute(q);
        }

        console.log('✅ GenieACS Settings Seeded/Updated!');
        console.log('NOTE: If connection is refused, please change the IP in Settings > System');
        await conn.end();
    } catch (e) {
        console.error('❌ Error seeding:', e);
    }
}

seedGenieacs();
