
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function test() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing',
            connectTimeout: 5000
        });
        console.log('Inserting test discount...');
        const [result] = await conn.query(
            "INSERT INTO discounts (invoice_id, discount_type, discount_value, reason, created_at) VALUES (513, 'manual', 1, 'Test Script', NOW())"
        );
        console.log('Inserted! ID:', result.insertId);

        console.log('Cleaning up...');
        await conn.query("DELETE FROM discounts WHERE id = ?", [result.insertId]);
        console.log('Cleaned up.');

        await conn.end();
    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        process.exit();
    }
}

test();
