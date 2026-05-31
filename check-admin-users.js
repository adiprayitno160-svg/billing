const m = require('mysql2/promise');
require('dotenv').config();

async function main() {
    const pool = m.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });
    
    const [rows] = await pool.query('SELECT id, full_name, username, role, phone, is_active FROM users ORDER BY role');
    console.log('=== SEMUA USER ===');
    console.table(rows);
    
    const [eligible] = await pool.query("SELECT id, full_name, role, phone FROM users WHERE role IN ('admin', 'superadmin', 'operator') AND is_active = 1 AND phone IS NOT NULL");
    console.log('\n=== AKAN DAPAT NOTIFIKASI BAYAR (sekarang) ===');
    console.table(eligible);
    
    await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
