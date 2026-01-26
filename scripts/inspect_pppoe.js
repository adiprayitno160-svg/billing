
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspectPPPoETables() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [tables] = await connection.query("SHOW TABLES LIKE '%pppoe%'");
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log('Found tables:', tableNames);

        for (const tableName of tableNames) {
            console.log(`\n--- ${tableName} ---`);
            const [cols] = await connection.query(`DESCRIBE ${tableName}`);
            console.log(cols.map(c => c.Field).join(', '));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

inspectPPPoETables();
