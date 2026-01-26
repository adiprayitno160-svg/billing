const mysql = require('mysql2/promise');
require('dotenv').config();

async function listDbs() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    try {
        const [rows] = await connection.execute("SHOW DATABASES");
        console.log("Databases:", JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

listDbs();
