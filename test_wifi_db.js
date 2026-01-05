
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Load env
dotenv.config();

async function runTest() {
    try {
        console.log('Connecting to DB...');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'billing',
            password: process.env.DB_PASSWORD || 'password123',
            database: process.env.DB_NAME || 'billing_db'
        });

        console.log('✅ Connected.');

        // 1. Ambil 1 customer
        const [rows] = await connection.query('SELECT id, name, phone FROM customers LIMIT 1');
        if (rows.length === 0) {
            console.log('❌ Tidak ada customer untuk di-test. Tolong buat 1 customer dulu.');
            await connection.end();
            return;
        }
        const customer = rows[0];
        console.log(`\n👤 Customer Test: ${customer.name} (ID: ${customer.id})`);

        // 2. Simulasi Update WiFi
        const testSSID = "WiFi_Percobaan_Sistem";
        const testPass = "kuncirahasia888";
        
        console.log(`\n🔄 Menyimpan data WiFi ke database...`);
        await connection.query(
            'UPDATE customers SET wifi_ssid = ?, wifi_password = ? WHERE id = ?',
            [testSSID, testPass, customer.id]
        );
        console.log(`✅ UPDATE Sukses.`);

        // 3. Verifikasi Data
        console.log(`\n🔍 Memeriksa ulang data dari database...`);
        const [check] = await connection.query('SELECT wifi_ssid, wifi_password FROM customers WHERE id = ?', [customer.id]);
        
        console.log('------------------------------------------------');
        console.log('HASIL DI DATABASE:');
        console.log('SSID     :', check[0].wifi_ssid);
        console.log('PASSWORD :', check[0].wifi_password);
        console.log('------------------------------------------------');

        if (check[0].wifi_ssid === testSSID && check[0].wifi_password === testPass) {
            console.log('✨ KESIMPULAN: Fitur penyimpanan database BERHASIL & SIAP DIGUNAKAN! ✨');
        } else {
            console.log('❌ Gagal verifikasi data.');
        }

        await connection.end();

    } catch (err) {
        console.error('❌ Error:', err.message);
        if(err.code === 'ER_BAD_FIELD_ERROR') {
             console.error('💡 Kemungkinan kolom wifi_ssid/wifi_password BELUM TERBUAT di tabel customers.');
        }
    }
}

runTest();
