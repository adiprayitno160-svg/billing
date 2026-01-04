const mysql = require('mysql2/promise');

async function checkCustomer() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'billing'
    });

    const [rows] = await connection.execute(
        'SELECT id, name, serial_number, connection_type FROM customers WHERE id = ?',
        [60]
    );

    console.log('Customer ID 60:', rows[0]);
    await connection.end();
}

checkCustomer().catch(console.error);
