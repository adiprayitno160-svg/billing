const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function fixKasirPassword() {
    let connection;
    
    try {
        // Buat koneksi ke database
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing'
        });

        console.log('✓ Koneksi database berhasil');

        // Hash password "kasir"
        const password = 'kasir';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        console.log('✓ Password berhasil di-hash');

        // Cek apakah user kasir sudah ada
        const [users] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            ['kasir']
        );

        if (users.length > 0) {
            // Update user kasir yang sudah ada
            await connection.execute(
                'UPDATE users SET password = ?, is_active = 1, role = ?, updated_at = NOW() WHERE username = ?',
                [hashedPassword, 'kasir', 'kasir']
            );
            console.log('✓ Password user kasir berhasil diupdate');
        } else {
            // Buat user kasir baru
            await connection.execute(
                'INSERT INTO users (username, email, password, full_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())',
                ['kasir', 'kasir@billing.com', hashedPassword, 'Kasir', 'kasir']
            );
            console.log('✓ User kasir baru berhasil dibuat');
        }

        console.log('\n========================================');
        console.log('✅ BERHASIL! User kasir sudah diperbaiki');
        console.log('========================================');
        console.log('Username: kasir');
        console.log('Password: kasir');
        console.log('URL Login: http://localhost:3001/kasir/login');
        console.log('========================================\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Jalankan script
fixKasirPassword();

