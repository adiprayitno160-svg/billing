
const mysql = require('mysql2/promise');
require('dotenv').config();

async function findLatestActivity() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [tables] = await connection.query('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);

        console.log('--- Searching for activity in last 48 hours ---');
        for (const table of tableNames) {
            try {
                const [cols] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
                const hasCreatedAt = cols.some(c => c.Field === 'created_at');
                const hasUpdatedAt = cols.some(c => c.Field === 'updated_at');

                if (hasCreatedAt || hasUpdatedAt) {
                    const timeCol = hasUpdatedAt ? 'updated_at' : 'created_at';
                    const [rows] = await connection.query(`
                        SELECT * FROM \`${table}\` 
                        WHERE \`${timeCol}\` >= DATE_SUB(NOW(), INTERVAL 2 DAY)
                        ORDER BY \`${timeCol}\` DESC
                        LIMIT 5
                    `);
                    if (rows.length > 0) {
                        console.log(`Table: ${table}`);
                        console.log(JSON.stringify(rows, null, 2));
                    }
                }
            } catch (e) { }
        }
        await connection.end();
    } catch (err) {
        console.log('ERROR: ' + err.message);
    }
}
findLatestActivity();
