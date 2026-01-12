
const RouterOSAPI = require('node-routeros').RouterOSAPI;
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    // 1. Get Passwords from DB
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [rows] = await conn.execute('SELECT * FROM mikrotik_settings');
    const passwords = rows.map(r => r.password).filter(p => p);
    conn.end();

    passwords.push('123456');
    passwords.push('1234');
    passwords.push('admin');
    passwords.push('');
    passwords.push('billing');

    // Unique
    const uniquePass = [...new Set(passwords)];

    console.log(`Trying ${uniquePass.length} passwords...`);

    const users = ['adi', 'adii', 'admin'];

    for (const user of users) {
        for (const pass of uniquePass) {
            console.log(`Trying User: ${user} Pass: ${pass.substring(0, 3)}***`);
            const client = new RouterOSAPI({
                host: '192.168.239.222',
                port: 8728,
                user: user,
                password: pass,
                timeout: 3000
            });

            try {
                await client.connect();
                console.log(`✅ SUCCESS! User: ${user} Password: ${pass}`);
                // Verify we can read queues
                const queues = await client.write('/queue/tree/print', ['?limit=1']);
                console.log('Queues read successfully.');
                client.close();

                // UPDATE DB
                console.log('UPDATING DATABASE WITH WORKING CREDENTIALS...');
                const conn2 = await mysql.createConnection({
                    host: process.env.DB_HOST,
                    user: process.env.DB_USER,
                    password: process.env.DB_PASSWORD,
                    database: process.env.DB_NAME
                });

                // Update specific row or add new priority row
                // We'll update the latest row (ID 2 usually)
                await conn2.execute('UPDATE mikrotik_settings SET host=?, username=?, password=?, use_tls=0 ORDER BY id DESC LIMIT 1', ['192.168.239.222', user, pass]);
                console.log('✅ DATABASE UPDATED.');
                conn2.end();
                process.exit(0);

            } catch (e) {
                // console.log(`Failed: ${e.message}`);
                // ignore
            }
        }
    }
    console.log('❌ All combinations failed.');
}

run();
