
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function fixPppoeRequestsTable() {
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

        // Create pppoe_new_requests table
        console.log('Checking pppoe_new_requests table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS pppoe_new_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_name VARCHAR(191) NOT NULL,
                phone VARCHAR(50) NULL,
                email VARCHAR(191) NULL,
                address TEXT NULL,
                package_id INT NULL,
                status ENUM('pending', 'approved', 'rejected', 'processed') DEFAULT 'pending',
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_created_at (created_at),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ pppoe_new_requests table checked/created.');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (conn) await conn.end();
    }
}

fixPppoeRequestsTable();
