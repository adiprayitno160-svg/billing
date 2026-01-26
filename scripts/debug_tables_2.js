
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function listTables() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [tables] = await connection.query("SHOW TABLES LIKE '%ackage%'");
        console.log('Tables matching "ackage":', tables);

        const [tables2] = await connection.query("SHOW TABLES LIKE '%plan%'");
        console.log('Tables matching "plan":', tables2);

        const [tables3] = await connection.query("SHOW TABLES LIKE '%packet%'");
        console.log('Tables matching "packet":', tables3);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

listTables();
