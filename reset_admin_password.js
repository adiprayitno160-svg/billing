const mysql = require('mysql2/promise');
require('dotenv').config();

const bcrypt = require('bcrypt');

async function resetAdmin() {
    console.log('--- Resetting Admin Password ---');
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const hash = await bcrypt.hash('admin', 10);

        // Update admin user
        const [res] = await conn.query("UPDATE users SET password = ? WHERE username = 'admin'", [hash]);
        console.log('Update result:', res);

        if (res.affectedRows > 0) {
            console.log('✅ Admin password reset to: admin');
        } else {
            console.log('⚠️  Admin user not found to reset!');
        }

        await conn.end();

    } catch (e) {
        console.error('❌ Reset Failed:', e.message);
    }
}

resetAdmin();
