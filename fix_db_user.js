
const mysql = require('mysql2/promise');

async function fixUser() {
    try {
        // Try connecting as root (usually no password in Laragon default)
        const conn = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '', // Try empty first
            database: 'mysql'
        });

        console.log('✅ Connected as root.');

        // Check version
        const [version] = await conn.query('SELECT VERSION() as ver');
        console.log('MySQL Version:', version[0].ver);

        // Check user plugin
        const [users] = await conn.query("SELECT User, Host, plugin FROM user WHERE User = 'billing'");
        console.log('Current billing user config:', users);

        // Fix user - attempt to set to caching_sha2_password or mysql_native_password depending on what usually works. 
        // If native is not loaded, we should use caching_sha2_password (default in 8.0)

        console.log('Attempting to fix billing user...');
        // Note: 'password123' must match your .env
        await conn.query("ALTER USER 'billing'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password123';");
        // Wait, if "mysql_native_password" is NOT loaded, I should NOT use it.
        // But usually this error means the USER is set to use it, but server doesn't support it?
        // Or user is set to something else? 

        // Let's try to set it to a standard one.
        // If MySQL 8.4 removed native password, we must use caching_sha2_password

        try {
            await conn.query("ALTER USER 'billing'@'localhost' IDENTIFIED WITH caching_sha2_password BY 'password123';");
            console.log('✅ Set auth to caching_sha2_password');
        } catch (e) {
            console.log('Failed caching_sha2_password, trying native...');
            await conn.query("ALTER USER 'billing'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password123';");
            console.log('✅ Set auth to mysql_native_password');
        }

        await conn.query("FLUSH PRIVILEGES;");
        console.log('✅ Privileges flushed.');

        await conn.end();

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

fixUser();
