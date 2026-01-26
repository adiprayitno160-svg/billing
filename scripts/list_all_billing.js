const mysql = require('mysql2/promise');
require('dotenv').config();

async function findAll() {
    const connection = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'billing'
    });
    const [rows] = await connection.execute("SELECT id, name, phone FROM customers");
    console.log("All customers in 'billing' DB:");
    console.log(JSON.stringify(rows, null, 2));
    await connection.end();
}
findAll();
