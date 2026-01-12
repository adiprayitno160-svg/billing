
const RouterOSAPI = require('node-routeros').RouterOSAPI;

async function run() {
    console.log("=== CHECKING CONNECTION TO 192.168.239.222 ===");

    // Hardcoded credentials from DB output, but changing Host
    const config = {
        host: '192.168.239.222',
        port: 8728,
        user: 'adii', // from previous output
        password: 'adi' // I need to know the password. 
        // Wait, I don't know the password plain text, I retrieved it from DB in previous script but didn't print it.
        // I need to fetch it from DB again.
    };

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
    config.password = rows[0].password;
    conn.end();

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
        console.log('✅ CONNECTED SUCCESSFULLY TO 192.168.239.222!');
        client.close();
    } catch (e) {
        console.error('❌ CONNECTION FAILED:', e.message);
    }
}

run();
