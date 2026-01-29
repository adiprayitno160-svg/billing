
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
            database: process.env.DB_NAME || process.env.DB_DATABASE || 'billing_db'
        });

        const [columns] = await conn.execute('DESCRIBE pppoe_packages');
        console.log('--- pppoe_packages Columns ---');
        console.log(columns.map(c => c.Field).join(', '));

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (conn) conn.end();
    }
})();
