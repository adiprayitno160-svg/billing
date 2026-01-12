
const mysql = require('mysql2/promise');
const RouterOSAPI = require('node-routeros').RouterOSAPI;
require('dotenv').config();

async function run() {
    console.log("=== CHECKING MIKROTIK CONNECTION ===");

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [rows] = await conn.execute('SELECT * FROM mikrotik_settings LIMIT 1');
    const cfg = rows[0];
    if (!cfg) { console.log('No Config'); process.exit(1); }

    console.log(`Host: ${cfg.host}`);
    console.log(`Port: ${cfg.port} (API Port)`);
    console.log(`User: ${cfg.username}`);
    console.log(`Use TLS: ${cfg.use_tls}`);

    const client = new RouterOSAPI({
        host: cfg.host,
        port: cfg.port,
        user: cfg.username,
        password: cfg.password,
        timeout: 5000 // 5s timeout
    });

    console.log('Connecting...');
    try {
        await client.connect();
        console.log('✅ CONNECTED SUCCESSFULLY!');

        const resource = await client.write('/system/resource/print');
        console.log('Resource:', resource[0]);

        client.close();
    } catch (e) {
        console.error('❌ CONNECTION FAILED:', e);
    }
    conn.end();
}

run();
