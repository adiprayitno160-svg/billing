
const mysql = require('mysql2/promise');

async function setupDb() {
    try {
        console.log('Connecting as root...');
        const conn = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
        });

        console.log('✅ Connected.');

        // Create Database
        console.log('Creating database billing_db...');
        await conn.query('CREATE DATABASE IF NOT EXISTS billing_db');

        // Create User (MySQL 8.4+ compatible)
        console.log('Creating user billing...');
        // Drop first just in case
        await conn.query("DROP USER IF EXISTS 'billing'@'localhost'");

        // Use caching_sha2_password which is default and supported in 8.4
        await conn.query("CREATE USER 'billing'@'localhost' IDENTIFIED WITH caching_sha2_password BY 'password123'");

        console.log('Granting privileges...');
        await conn.query("GRANT ALL PRIVILEGES ON billing_db.* TO 'billing'@'localhost'");
        await conn.query("FLUSH PRIVILEGES");

        console.log('✅ Setup Complete. User billing created.');
        await conn.end();

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

setupDb();
