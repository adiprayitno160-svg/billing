const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCustomer() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });

    try {
        const [count] = await connection.execute("SELECT COUNT(*) as total FROM customers");
        console.log("Total Customers:", count[0].total);

        const [rows] = await connection.execute("SELECT id, name, phone FROM customers WHERE name LIKE '%Teo%' OR name LIKE '%Ady%'");
        console.log("Search Results:", JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

checkCustomer();
