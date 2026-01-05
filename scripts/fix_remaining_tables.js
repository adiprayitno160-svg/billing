
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function fixRemainingTables() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing',
        multipleStatements: true
    };

    console.log(`Connecting to database ${config.database} as ${config.user}...`);

    let conn;
    try {
        conn = await mysql.createConnection(config);
        console.log('Connected.');

        // 1. Create company_settings
        console.log('Checking company_settings table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS company_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_name VARCHAR(191) DEFAULT 'Billing System',
                company_address TEXT NULL,
                company_phone VARCHAR(50) NULL,
                company_email VARCHAR(191) NULL,
                company_website VARCHAR(191) NULL,
                logo_url VARCHAR(255) NULL,
                template_header TEXT NULL,
                template_footer TEXT NULL,
                font_size VARCHAR(10) DEFAULT '14',
                paper_size VARCHAR(20) DEFAULT 'A4',
                orientation ENUM('portrait', 'landscape') DEFAULT 'portrait',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ company_settings table checked/created.');

        // Insert default company row if empty
        const [rows] = await conn.query('SELECT COUNT(*) as count FROM company_settings');
        if (rows[0].count === 0) {
            await conn.query(`
                INSERT INTO company_settings (company_name) VALUES ('My Access Point')
            `);
            console.log('   Inserted default company settings.');
        }

        // 2. Create system_settings
        console.log('Checking system_settings table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(191) UNIQUE NOT NULL,
                setting_value TEXT NULL,
                description TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ system_settings table checked/created.');

        // Insert default auto_logout_enabled if not exists
        await conn.query(`
            INSERT IGNORE INTO system_settings (setting_key, setting_value, description) 
            VALUES ('auto_logout_enabled', 'true', 'Enable auto logout after inactivity')
        `);
        console.log('   Verified auto_logout_enabled setting.');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (conn) await conn.end();
    }
}

fixRemainingTables();
