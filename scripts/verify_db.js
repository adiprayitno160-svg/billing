
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function verifyDatabase() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing',
    };

    console.log(`[Verify] Connecting to ${config.database} as ${config.user}...`);

    let conn;
    try {
        conn = await mysql.createConnection(config);
        console.log('[Verify] Connected.');

        const tablesToCheck = [
            'customers',
            'pppoe_packages',
            'pppoe_profiles',
            'company_settings',
            'system_settings',
            'pppoe_new_requests',
            'ftth_olt',
            'ftth_odc',
            'ftth_odp'
        ];

        console.log('[Verify] Checking tables...');
        for (const table of tablesToCheck) {
            try {
                const [rows] = await conn.query(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`   ✅ Table '${table}' exists. Rows: ${rows[0].count}`);
            } catch (err) {
                if (err.code === 'ER_NO_SUCH_TABLE') {
                    console.error(`   ❌ Table '${table}' DOES NOT EXIST!`);
                } else {
                    console.error(`   ⚠️ Error checking '${table}': ${err.message}`);
                }
            }
        }

    } catch (err) {
        console.error('[Verify] Connection Failed:', err.message);
    } finally {
        if (conn) await conn.end();
    }
}

verifyDatabase();
