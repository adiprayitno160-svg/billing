const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD
        });
        const [rows] = await conn.execute("SELECT username, role, password FROM users LIMIT 10");
        console.log(JSON.stringify(rows, null, 2));
        await conn.end();
    } catch (e) { console.error(e); }
}
check();
