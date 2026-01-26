const mysql = require('mysql2/promise');
const { RouterOSAPI } = require('node-routeros');
require('dotenv').config();

async function checkMikrotik() {
    console.log("Checking MikroTik...");
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });

    try {
        const [rows] = await connection.execute('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
        if (rows.length === 0) {
            console.log("No MikroTik settings found.");
            return;
        }
        const config = rows[0];

        const conn = new RouterOSAPI({
            host: config.host,
            user: config.username,
            password: config.password,
            port: config.port || 8728,
            timeout: 10
        });

        await conn.connect();

        console.log("Connected to MikroTik. Searching for 'Teo' or 'Ady'...");

        // Search in PPPoE Secrets
        const secrets = await conn.write('/ppp/secret/print', [
            '?name~Teo',
            '?comment~Teo',
            '?name~Ady',
            '?comment~Ady',
            '|' // OR logic? No, node-routeros query syntax varies. 
            // Better to get all and filter in JS if not sure about complex queries.
        ]);

        console.log("PPPoE Secrets matching 'Teo' or 'Ady':", JSON.stringify(secrets, null, 2));

        // Let's just get all secrets and filter here to be safe
        const allSecrets = await conn.write('/ppp/secret/print');
        const filteredSecrets = allSecrets.filter(s =>
            (s.name && (s.name.toLowerCase().includes('teo') || s.name.toLowerCase().includes('ady'))) ||
            (s.comment && (s.comment.toLowerCase().includes('teo') || s.comment.toLowerCase().includes('ady')))
        );
        console.log("Filtered PPPoE Secrets:", JSON.stringify(filteredSecrets, null, 2));

        await conn.close();
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await connection.end();
    }
}

checkMikrotik();
