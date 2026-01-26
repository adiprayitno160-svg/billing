const mysql = require('mysql2/promise');
require('dotenv').config();

async function listTables(db) {
    console.log(`\n--- Tables in: ${db} ---`);
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: db
        });

        try {
            const [rows] = await connection.execute("SHOW TABLES");
            console.log(JSON.stringify(rows, null, 2));
        } catch (err) {
            console.error(err);
        } finally {
            await connection.end();
        }
    } catch (err) {
        console.error(err);
    }
}

async function run() {
    await listTables('rtrwbilling');
    await listTables('rtrwbill');
}

run();
