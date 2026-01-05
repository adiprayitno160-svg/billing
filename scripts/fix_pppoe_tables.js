
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function fixTables() {
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

        // 1. Check/Create pppoe_profiles
        console.log('Checking pppoe_profiles table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS pppoe_profiles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(191) NOT NULL UNIQUE,
                local_address VARCHAR(191) NULL,
                remote_address_pool VARCHAR(191) NULL,
                dns_server VARCHAR(191) NULL,
                rate_limit VARCHAR(50) NULL,
                rate_limit_rx VARCHAR(50) DEFAULT '0',
                rate_limit_tx VARCHAR(50) DEFAULT '0',
                burst_limit_rx VARCHAR(50) NULL,
                burst_limit_tx VARCHAR(50) NULL,
                burst_threshold_rx VARCHAR(50) NULL,
                burst_threshold_tx VARCHAR(50) NULL,
                burst_time_rx VARCHAR(50) NULL,
                burst_time_tx VARCHAR(50) NULL,
                session_timeout VARCHAR(50) NULL,
                idle_timeout VARCHAR(50) NULL,
                keepalive_timeout VARCHAR(50) NULL,
                only_one ENUM('yes', 'no') DEFAULT 'no',
                change_tcp_mss ENUM('yes', 'no', 'default') DEFAULT 'default',
                use_compression ENUM('yes', 'no', 'default') DEFAULT 'default',
                use_encryption ENUM('yes', 'no', 'default') DEFAULT 'default',
                use_mpls ENUM('yes', 'no', 'default') DEFAULT 'default',
                use_upnp ENUM('yes', 'no', 'default') DEFAULT 'default',
                comment TEXT NULL,
                status ENUM('active','inactive') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ pppoe_profiles table checked/created.');

        // 2. Check/Create pppoe_packages
        console.log('Checking pppoe_packages table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS pppoe_packages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(191) NOT NULL,
                profile_id INT NULL,
                price DECIMAL(12,2) DEFAULT 0,
                price_7_days DECIMAL(12,2) DEFAULT 0,
                price_30_days DECIMAL(12,2) DEFAULT 0,
                duration_days INT DEFAULT 30,
                auto_activation TINYINT(1) DEFAULT 0,
                status ENUM('active','inactive') DEFAULT 'active',
                description TEXT NULL,
                rate_limit_rx VARCHAR(50) DEFAULT '0',
                rate_limit_tx VARCHAR(50) DEFAULT '0',
                burst_limit_rx VARCHAR(50) NULL,
                burst_limit_tx VARCHAR(50) NULL,
                burst_threshold_rx VARCHAR(50) NULL,
                burst_threshold_tx VARCHAR(50) NULL,
                burst_time_rx VARCHAR(50) NULL,
                burst_time_tx VARCHAR(50) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_pppoe_package_profile FOREIGN KEY (profile_id) REFERENCES pppoe_profiles(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ pppoe_packages table checked/created.');

        // 3. Ensure columns exist if table already existed (e.g. price_7_days could be missing)
        console.log('Verifying columns in pppoe_packages...');
        const addCol = async (sql) => {
            try { await conn.query(sql); console.log(`   Executed: ${sql}`); }
            catch (err) {
                if (!err.message.includes('Duplicate column name')) {
                    console.warn(`   Warning: ${err.message}`);
                }
            }
        };

        await addCol("ALTER TABLE pppoe_packages ADD COLUMN price_7_days DECIMAL(12,2) DEFAULT 0 AFTER price");
        await addCol("ALTER TABLE pppoe_packages ADD COLUMN price_30_days DECIMAL(12,2) DEFAULT 0 AFTER price_7_days");

        console.log('✅ All tables verified.');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (conn) await conn.end();
    }
}

fixTables();
