const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkKasirUser() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing'
        });

        console.log('✓ Koneksi database berhasil\n');

        // Ambil data user kasir
        const [users] = await connection.execute(
            'SELECT id, username, email, full_name, role, is_active, created_at FROM users WHERE username = ?',
            ['kasir']
        );

        if (users.length === 0) {
            console.log('❌ User kasir tidak ditemukan di database!');
            return;
        }

        const user = users[0];

        console.log('========================================');
        console.log('       DATA USER KASIR');
        console.log('========================================');
        console.log('ID           :', user.id);
        console.log('Username     :', user.username);
        console.log('Email        :', user.email);
        console.log('Nama Lengkap :', user.full_name);
        console.log('Role         :', user.role);
        console.log('Status       :', user.is_active ? '✅ Aktif' : '❌ Tidak Aktif');
        console.log('Dibuat       :', user.created_at);
        console.log('========================================');
        console.log('\n✅ User kasir ditemukan dan siap digunakan!');
        console.log('\nSilakan login di:');
        console.log('URL      : http://localhost:3001/kasir/login');
        console.log('Username : kasir');
        console.log('Password : kasir');
        console.log('========================================\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkKasirUser();

