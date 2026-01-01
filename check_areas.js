const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing'
        });

        const [rows] = await conn.execute('SHOW TABLES LIKE "ftth_areas"');
        if (rows.length === 0) {
            console.log('FAIL: ftth_areas table missing');
            process.exit(1);
        }

        const [cols] = await conn.execute('SHOW COLUMNS FROM ftth_areas');
        const colNames = cols.map(c => c.Field);
        console.log('Columns:', colNames.join(', '));

        if (!colNames.includes('code') || !colNames.includes('name')) {
            console.log('FAIL: Missing required columns');
            process.exit(1);
        }

        console.log('PASS: Table ftth_areas exists');
        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
