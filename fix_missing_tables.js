const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDatabase() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing_db'
    });

    try {
        console.log('--- FIXING DATABASE TABLES ---');

        // 1. Create subscriptions table if not exists
        console.log('Creating subscriptions table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                package_id INT NULL,
                package_name VARCHAR(191) NULL,
                price DECIMAL(12,2) DEFAULT 0,
                status ENUM('active', 'suspended', 'inactive', 'cancelled') DEFAULT 'active',
                start_date DATETIME NULL,
                end_date DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_customer (customer_id),
                INDEX idx_status (status),
                CONSTRAINT fk_sub_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ subscriptions table created/verified.');


        // 2. Run Prepaid Migration Step explicitly
        console.log('\nRunning Prepaid System Migration steps (just in case)...');

        // Add billing_mode to customers
        try {
            await conn.query(`ALTER TABLE customers ADD COLUMN billing_mode ENUM('postpaid', 'prepaid') DEFAULT 'postpaid' AFTER status`);
            console.log('   ✅ customers.billing_mode added');
        } catch (e) { if (!e.message.includes('Duplicate')) console.error(e.message); }

        // Add expiry_date to customers
        try {
            await conn.query(`ALTER TABLE customers ADD COLUMN expiry_date DATETIME NULL AFTER billing_mode`);
            console.log('   ✅ customers.expiry_date added');
        } catch (e) { if (!e.message.includes('Duplicate')) console.error(e.message); }

        // Add price columns to pppoe_packages
        try {
            await conn.query(`ALTER TABLE pppoe_packages ADD COLUMN price_7_days DECIMAL(12,2) DEFAULT 0 AFTER price`);
            console.log('   ✅ pppoe_packages.price_7_days added');
        } catch (e) { if (!e.message.includes('Duplicate')) console.error(e.message); }

        try {
            await conn.query(`ALTER TABLE pppoe_packages ADD COLUMN price_30_days DECIMAL(12,2) DEFAULT 0 AFTER price_7_days`);
            console.log('   ✅ pppoe_packages.price_30_days added');
        } catch (e) { if (!e.message.includes('Duplicate')) console.error(e.message); }

        // Create payment_requests
        await conn.query(`
            CREATE TABLE IF NOT EXISTS payment_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                package_id INT NOT NULL,
                duration_days INT NOT NULL,
                base_amount DECIMAL(12,2) NOT NULL,
                unique_code INT NOT NULL,
                total_amount DECIMAL(12,2) NOT NULL,
                status ENUM('pending', 'paid', 'expired', 'cancelled') DEFAULT 'pending',
                expires_at DATETIME NOT NULL,
                paid_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_customer_id (customer_id),
                CONSTRAINT fk_payment_request_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ payment_requests table created/verified.');

        // Create prepaid_transactions
        await conn.query(`
            CREATE TABLE IF NOT EXISTS prepaid_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                payment_request_id INT NULL,
                package_id INT NOT NULL,
                duration_days INT NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                payment_method VARCHAR(50) DEFAULT 'transfer',
                previous_expiry_date DATETIME NULL,
                new_expiry_date DATETIME NOT NULL,
                verified_by INT NULL,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_prepaid_tx_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ prepaid_transactions table created/verified.');

    } catch (e) {
        console.error('❌ Error fixing database:', e);
    } finally {
        await conn.end();
    }
}

fixDatabase();
