
const RouterOSAPI = require('node-routeros').RouterOSAPI;

async function run() {
    console.log("=== CHECKING CONNECTION TO 192.168.239.222 with user 'adi' ===");

    // Fetch password from DB
    const mysql = require('mysql2/promise');
    require('dotenv').config();
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    const [rows] = await conn.execute('SELECT password FROM mikrotik_settings LIMIT 1');
    const dbPassword = rows[0].password;
    conn.end();

    const config = {
        host: '192.168.239.222',
        port: 8728,
        user: 'adi', // Trying single 'i'
        password: dbPassword
    };

    const client = new RouterOSAPI({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        timeout: 5000
    });

    console.log('Connecting...');
    try {
        await client.connect();
        console.log('✅ CONNECTED SUCCESSFULLY TO 192.168.239.222 with user adi!');
        client.close();
    } catch (e) {
        console.error('❌ CONNECTION FAILED:', e.message);
    }
}

run();
