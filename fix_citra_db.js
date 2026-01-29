
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    let conn;
    try {
        // Connect to database (Server uses .env, Local uses .env)
        // Fallback to defaults if env missing
        conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
            database: process.env.DB_NAME || process.env.DB_DATABASE || 'billing_db'
        });

        console.log('--- Cleaning Duplicate "Citra Diah" ---');

        // Find duplicates (Newest first)
        const [rows] = await conn.execute(
            "SELECT id, client_name, ip_address, created_at FROM static_ip_clients WHERE client_name LIKE '%Citra Diah%' ORDER BY id DESC"
        );

        console.log(`Found ${rows.length} records.`);
        if (rows.length > 0) {
            rows.forEach(r => console.log(`#${r.id} - ${r.client_name} - ${r.ip_address} (${r.created_at})`));
        }

        if (rows.length > 1) {
            const victim = rows[0]; // The newest one is likely the accidental double-click
            console.log(`\n⚠️ Deleting Duplicate (Newest): #${victim.id}`);

            await conn.execute('DELETE FROM static_ip_clients WHERE id = ?', [victim.id]);
            console.log('✅ Deleted successfully.');
        } else {
            console.log('\n✅ Data is clean (No duplicates found).');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (conn) conn.end();
    }
})();
