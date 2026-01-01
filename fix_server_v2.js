const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixServer() {
    console.log('🔧 Starting Server Fixes...');

    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing'
        });

        console.log('✅ Connected to database.');

        // 1. Create table pppoe_secrets if missing (Fixes 500 error logs)
        console.log('1️⃣ Check/Create table: pppoe_secrets');
        await conn.execute(`CREATE TABLE IF NOT EXISTS pppoe_secrets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255),
            service VARCHAR(50),
            profile VARCHAR(255),
            local_address VARCHAR(50),
            remote_address VARCHAR(50),
            last_logged_out DATETIME,
            comment TEXT,
            disabled ENUM('true', 'false') DEFAULT 'false',
            status VARCHAR(50) DEFAULT 'offline',
            uptime VARCHAR(50),
            last_seen DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP
        )`);
        console.log('   ✅ Table pppoe_secrets OK');

        // 2. Remove garbage data "LLALALAL" from static_ip_clients
        console.log('2️⃣ Cleaning up garbage data (LLALALAL)...');
        const [res] = await conn.execute("DELETE FROM static_ip_clients WHERE client_name LIKE '%LLALALAL%'");
        if (res.affectedRows > 0) {
            console.log(`   ✅ Deleted ${res.affectedRows} garbage rows.`);
        } else {
            console.log('   ℹ️ No garbage data found.');
        }

        await conn.end();
        console.log('✨ All fixes applied successfully!');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixServer();
