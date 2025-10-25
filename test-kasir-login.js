const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function testKasirLogin() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing'
        });

        console.log('========================================');
        console.log('   TEST KASIR LOGIN - VERIFICATION');
        console.log('========================================\n');

        // Ambil user kasir
        const [users] = await connection.execute(
            'SELECT * FROM users WHERE username = ?',
            ['kasir']
        );

        if (users.length === 0) {
            console.log('❌ User kasir tidak ditemukan!');
            return;
        }

        const user = users[0];
        console.log('✓ User kasir ditemukan');
        console.log('  - ID:', user.id);
        console.log('  - Username:', user.username);
        console.log('  - Email:', user.email);
        console.log('  - Role:', user.role);
        console.log('  - Status Aktif:', user.is_active ? 'Ya' : 'Tidak');
        console.log();

        // Test password
        const testPassword = 'kasir';
        console.log('Testing password verification...');
        console.log('  - Input Password:', testPassword);
        
        const isMatch = await bcrypt.compare(testPassword, user.password);
        
        console.log('  - Hash di DB:', user.password.substring(0, 30) + '...');
        console.log();

        if (isMatch) {
            console.log('========================================');
            console.log('✅ PASSWORD BENAR! Login akan berhasil');
            console.log('========================================');
        } else {
            console.log('========================================');
            console.log('❌ PASSWORD SALAH! Ada masalah hashing');
            console.log('========================================');
        }

        console.log('\nDetail Lengkap:');
        console.log('  - URL Login: http://localhost:3001/kasir/login');
        console.log('  - Username: kasir');
        console.log('  - Password: kasir');
        console.log('  - Role Check:', user.role === 'kasir' ? '✓ OK' : '✗ Error');
        console.log('  - Active Check:', user.is_active ? '✓ OK' : '✗ Error');
        console.log('  - Password Check:', isMatch ? '✓ OK' : '✗ Error');
        console.log('\n========================================\n');

        // Cek semua users untuk debugging
        console.log('Semua users di database:');
        const [allUsers] = await connection.execute(
            'SELECT id, username, role, is_active FROM users ORDER BY id'
        );
        
        console.table(allUsers);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

testKasirLogin();

