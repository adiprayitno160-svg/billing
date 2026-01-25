const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });

    const [rows] = await connection.execute('SELECT id, name FROM customers LIMIT 100');
    console.log('Results:', rows);

    await connection.end();
}

run().catch(console.error);
