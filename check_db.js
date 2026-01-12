
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [rows] = await conn.execute('SELECT id, name, max_limit_downlaod, max_limit_upload FROM static_ip_packages WHERE name LIKE "%PAKET 110%"');
    // typo check: max_limit_download vs max_limit_downlaod (common typo)
    // Actually let's assume correct spelling first, or check schema.
    const [cols] = await conn.execute('SHOW COLUMNS FROM static_ip_packages');
    console.log('Columns:', cols.map(c => c.Field));

    const [prows] = await conn.execute('SELECT * FROM static_ip_packages WHERE name LIKE "%PAKET 110%"');
    console.log('Package:', prows);

    const [crows] = await conn.execute('SELECT * FROM customers WHERE name LIKE "%Ponakanae%"');
    console.log('Customer:', crows);

    await conn.end();
}

run().catch(console.error);
