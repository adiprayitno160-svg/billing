
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        const [rows] = await connection.query(`
            SELECT v.id, v.customer_id, v.extracted_amount, v.status, v.reason, v.created_at
            FROM manual_payment_verifications v
            WHERE v.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ORDER BY v.created_at DESC
            LIMIT 50
        `);
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}
main();
