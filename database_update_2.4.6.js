const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateDatabase() {
    console.log('🔄 Starting Database Update for v2.4.6...');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });

    console.log('✅ Connected to database.');

    try {
        // 1. Create bandwidth_logs table
        console.log('1️⃣ Check/Create table: bandwidth_logs');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS bandwidth_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                bytes_in BIGINT DEFAULT 0,
                bytes_out BIGINT DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_customer_timestamp (customer_id, timestamp),
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Create payment_requests table
        console.log('2️⃣ Check/Create table: payment_requests');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS payment_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                package_id INT NOT NULL,
                duration_days INT NOT NULL,
                base_amount DECIMAL(15,2) NOT NULL,
                unique_code INT NOT NULL,
                total_amount DECIMAL(15,2) NOT NULL,
                status ENUM('pending', 'paid', 'expired', 'failed') DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                payment_method VARCHAR(50) DEFAULT 'bank_transfer',
                payment_proof VARCHAR(255) DEFAULT NULL,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 3. Create prepaid_transactions table
        console.log('3️⃣ Check/Create table: prepaid_transactions');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS prepaid_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                transaction_type ENUM('activation', 'renewal', 'topup') NOT NULL,
                payment_request_id INT NULL,
                package_name VARCHAR(100) NULL,
                duration_days INT NULL,
                previous_expiry DATETIME NULL,
                new_expiry DATETIME NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT NULL,
                created_by INT NULL,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 4. Update customers table columns
        console.log('4️⃣ Checking customers table columns...');
        const [columns] = await connection.execute("SHOW COLUMNS FROM customers");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('billing_mode')) {
            console.log('   ➕ Adding billing_mode column');
            await connection.execute("ALTER TABLE customers ADD COLUMN billing_mode ENUM('postpaid', 'prepaid') DEFAULT 'postpaid' AFTER status");
        }

        if (!columnNames.includes('expiry_date')) {
            console.log('   ➕ Adding expiry_date column');
            await connection.execute("ALTER TABLE customers ADD COLUMN expiry_date DATETIME NULL AFTER billing_mode");
        }

        // 5. Update pppoe_packages columns
        console.log('5️⃣ Checking pppoe_packages table columns...');
        const [pkgColumns] = await connection.execute("SHOW COLUMNS FROM pppoe_packages");
        const pkgColumnNames = pkgColumns.map(c => c.Field);

        if (!pkgColumnNames.includes('price_7_days')) {
            console.log('   ➕ Adding price_7_days column');
            await connection.execute("ALTER TABLE pppoe_packages ADD COLUMN price_7_days DECIMAL(10, 2) DEFAULT 0 AFTER price");
        }
        if (!pkgColumnNames.includes('price_30_days')) {
            console.log('   ➕ Adding price_30_days column');
            await connection.execute("ALTER TABLE pppoe_packages ADD COLUMN price_30_days DECIMAL(10, 2) DEFAULT 0 AFTER price_7_days");
        }

        console.log('✅ DATABASE UPDATE COMPLETED SUCCESSFULLY!');

    } catch (error) {
        console.error('❌ Error updating database:', error);
    } finally {
        await connection.end();
    }
}

updateDatabase();
