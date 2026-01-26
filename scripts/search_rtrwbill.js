const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCustomer() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'rtrwbill'
    });

    try {
        const [rows] = await connection.execute("SELECT * FROM pelanggan WHERE nama LIKE '%Teo%' OR nama LIKE '%Ady%'");
        console.log("Search Results (rtrwbill.pelanggan):", JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

checkCustomer();
