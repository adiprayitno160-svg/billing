const mysql = require('mysql2/promise');

async function updateCorrectSerial() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'billing'
    });

    const correctSerial = '4857544365A5A895';
    
    console.log('📝 Updating serial_number untuk customer ID 60...\n');
    console.log('Serial Number: ' + correctSerial);

    // Update dengan serial number yang benar
    const [result] = await connection.execute(
        'UPDATE customers SET serial_number = ? WHERE id = ?',
        [correctSerial, 60]
    );

    console.log(`✅ Updated ${result.affectedRows} row(s)`);

    // Verify
    const [rows] = await connection.execute(
        'SELECT id, name, serial_number FROM customers WHERE id = ?',
        [60]
    );

    console.log('\n📊 Data setelah update:');
    console.log(rows[0]);
    console.log('\n🔗 Serial Number yang digunakan: ' + correctSerial);
    console.log('🔗 Tunggu build selesai, lalu buka: http://localhost:3001/customers/60');

    await connection.end();
}

updateCorrectSerial().catch(console.error);
