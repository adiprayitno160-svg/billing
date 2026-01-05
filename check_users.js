const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUsers() {
    console.log('--- Checking Users in DB: ' + process.env.DB_NAME + ' ---');
    console.log('User:', process.env.DB_USER);

    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        // Check if users table exists
        const [tables] = await conn.query("SHOW TABLES LIKE 'users'");
        if (tables.length === 0) {
            console.log('❌ Table "users" does NOT exist!');
        } else {
            console.log('✅ Table "users" exists.');

            // Check columns
            const [cols] = await conn.query("DESCRIBE users");
            console.log('Columns:', cols.map(c => c.Field).join(', '));

            // Check users content
            const [rows] = await conn.query("SELECT id, username, email FROM users");
            console.log('Users found:', rows.length);
            console.table(rows);

            if (rows.length === 0) {
                console.log('Creating default admin user...');
                const bcrypt = require('bcryptjs');
                const hash = await bcrypt.hash('password123', 10);
                await conn.query("INSERT INTO users (username, password, description, role, created_at) VALUES (?, ?, ?, ?, NOW())",
                    ['admin', hash, 'Administrator', 'admin']);
                console.log('✅ Created user: admin / password123');
            }
        }

        await conn.end();
        console.log('✅ Database connection OK.');

    } catch (e) {
        console.error('❌ Connection Failed:', e.message);
    }
}

checkUsers();
