
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
        const [tables] = await connection.query('SHOW TABLES');
        console.log('Tables:', tables.map(t => Object.values(t)[0]));

        // Also describe subscriptions to see columns
        console.log('\n--- Subscriptions Table ---');
        const [subCols] = await connection.query('DESCRIBE subscriptions');
        console.log(subCols.map(c => `${c.Field} (${c.Type})`).join('\n'));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

listTables();
