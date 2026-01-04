const mysql = require('mysql2/promise');

async function addSerialNumber() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'billing'
    });

    console.log('📝 Menambahkan serial_number ke customer ID 60...\n');

    // Update customer dengan serial number contoh
    const [result] = await connection.execute(
        'UPDATE customers SET serial_number = ? WHERE id = ?',
        ['ZTEGC8B8FD96', 60] // Serial number contoh ONT ZTE
    );

    console.log(`✅ Updated ${result.affectedRows} row(s)`);

    // Verify
    const [rows] = await connection.execute(
        'SELECT id, name, serial_number FROM customers WHERE id = ?',
        [60]
    );

    console.log('\n📊 Data setelah update:');
    console.log(rows[0]);
    console.log('\n🔗 Sekarang buka: http://localhost:3001/customers/60');
    console.log('   Anda seharusnya melihat ONT Status Card!');

    await connection.end();
}

addSerialNumber().catch(console.error);
