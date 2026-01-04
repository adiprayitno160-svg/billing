const mysql = require('mysql2/promise');

async function findCustomersWithSerial() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'billing'
    });

    const [rows] = await connection.execute(
        `SELECT id, name, serial_number, connection_type 
         FROM customers 
         WHERE serial_number IS NOT NULL 
         LIMIT 10`
    );

    console.log('Customers dengan Serial Number:');
    rows.forEach(row => {
        console.log(`ID: ${row.id} | Name: ${row.name} | SN: ${row.serial_number}`);
    });

    if (rows.length === 0) {
        console.log('\n❌ Tidak ada customer dengan serial_number!');
        console.log('\nAnda perlu menambahkan serial_number ke customer terlebih dahulu.');
        console.log('Contoh: UPDATE customers SET serial_number = "ZTEGC1234567" WHERE id = 60;');
    }

    await connection.end();
}

findCustomersWithSerial().catch(console.error);
