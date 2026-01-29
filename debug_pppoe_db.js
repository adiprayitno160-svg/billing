
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
            database: process.env.DB_NAME || process.env.DB_DATABASE || 'billing_db'
        });

        console.log('--- LAST 5 PPPoE Packages in DB ---');
        const [rows] = await conn.execute('SELECT id, name, profile_id, price, status, created_at FROM pppoe_packages ORDER BY id DESC LIMIT 5');
        rows.forEach(r => {
            console.log(`ID: ${r.id} | Name: ${r.name} | Created: ${r.created_at}`);
        });

        console.log('\n--- LAST 5 PPPoE Profiles in DB ---');
        const [profiles] = await conn.execute('SELECT id, name, created_at FROM pppoe_profiles ORDER BY id DESC LIMIT 5');
        profiles.forEach(p => {
            console.log(`ID: ${p.id} | Name: ${p.name} | Created: ${p.created_at}`);
        });

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (conn) conn.end();
    }
})();
