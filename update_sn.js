const mysql = require('mysql2/promise');

async function updateSerial() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'billing'
    });

    const correctSerial = '4857544365A5A895';

    console.log('📝 Updating serial number ke: ' + correctSerial);

    await connection.execute(
        'UPDATE customers SET serial_number = ? WHERE id = ?',
        [correctSerial, 60]
    );

    const [rows] = await connection.execute(
        'SELECT id, name, serial_number FROM customers WHERE id = ?',
        [60]
    );

    console.log('✅ Berhasil update!');
    console.log(rows[0]);

    await connection.end();
}

updateSerial().catch(console.error);
