import { databasePool } from '../pool';

/**
 * Migration: Add Prepaid System (Hybrid Billing)
 * 
 * Purpose: Enable hybrid billing system where customers can be switched
 * between postpaid (monthly invoicing) and prepaid (pay-before-use packages)
 * 
 * Changes:
 * 1. Add billing_mode and expiry_date to customers table
 * 2. Add price_7_days and price_30_days to pppoe_packages table
 * 3. Create payment_requests table for unique payment codes
 */

export async function runMigration(): Promise<void> {
    const conn = await databasePool.getConnection();

    try {
        console.log('🚀 Starting Prepaid System Migration...');

        // 1. Modify customers table
        console.log('📝 Adding billing_mode and expiry_date to customers table...');

        // Add billing_mode column (default: postpaid for existing customers)
        try {
            await conn.query(`
                ALTER TABLE customers 
                ADD COLUMN billing_mode ENUM('postpaid', 'prepaid') 
                DEFAULT 'postpaid' 
                COMMENT 'Postpaid = monthly invoice, Prepaid = pay before use'
                AFTER status
            `);
            console.log('   ✅ billing_mode column added');
        } catch (err: any) {
            if (err.message.includes('Duplicate column name')) {
                console.log('   ⏭️  billing_mode already exists, skipping');
            } else {
                throw err;
            }
        }

        // Add expiry_date column (for prepaid customers)
        try {
            await conn.query(`
                ALTER TABLE customers 
                ADD COLUMN expiry_date DATETIME NULL 
                COMMENT 'Expiration date/time for prepaid customers. NULL = unlimited/postpaid'
                AFTER billing_mode
            `);
            console.log('   ✅ expiry_date column added');
        } catch (err: any) {
            if (err.message.includes('Duplicate column name')) {
                console.log('   ⏭️  expiry_date already exists, skipping');
            } else {
                throw err;
            }
        }

        // Add index for expiry_date (for scheduler performance)
        try {
            await conn.query(`
                CREATE INDEX idx_expiry_date ON customers(expiry_date)
            `);
            console.log('   ✅ Index created on expiry_date');
        } catch (err: any) {
            if (err.message.includes('Duplicate key name')) {
                console.log('   ⏭️  Index already exists, skipping');
            } else {
                throw err;
            }
        }

        // 2. Modify pppoe_packages table
        console.log('📝 Adding prepaid pricing to pppoe_packages table...');

        // Add price_7_days column
        try {
            await conn.query(`
                ALTER TABLE pppoe_packages 
                ADD COLUMN price_7_days DECIMAL(12,2) DEFAULT 0 
                COMMENT 'Price for 7-day (weekly) package'
                AFTER price
            `);
            console.log('   ✅ price_7_days column added');
        } catch (err: any) {
            if (err.message.includes('Duplicate column name')) {
                console.log('   ⏭️  price_7_days already exists, skipping');
            } else {
                throw err;
            }
        }

        // Add price_30_days column
        try {
            await conn.query(`
                ALTER TABLE pppoe_packages 
                ADD COLUMN price_30_days DECIMAL(12,2) DEFAULT 0 
                COMMENT 'Price for 30-day (monthly) package'
                AFTER price_7_days
            `);
            console.log('   ✅ price_30_days column added');
        } catch (err: any) {
            if (err.message.includes('Duplicate column name')) {
                console.log('   ⏭️  price_30_days already exists, skipping');
            } else {
                throw err;
            }
        }

        // 3. Create payment_requests table
        console.log('📝 Creating payment_requests table...');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS payment_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                package_id INT NOT NULL,
                duration_days INT NOT NULL COMMENT '7 or 30 days',
                base_amount DECIMAL(12,2) NOT NULL COMMENT 'Original package price',
                unique_code INT NOT NULL COMMENT 'Random 3-digit code (100-999)',
                total_amount DECIMAL(12,2) NOT NULL COMMENT 'base_amount + unique_code',
                status ENUM('pending', 'paid', 'expired', 'cancelled') DEFAULT 'pending',
                expires_at DATETIME NOT NULL COMMENT 'Payment code valid until (1 hour)',
                paid_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_customer_id (customer_id),
                INDEX idx_status (status),
                INDEX idx_expires_at (expires_at),
                INDEX idx_total_amount (total_amount),
                CONSTRAINT fk_payment_request_customer FOREIGN KEY (customer_id) 
                    REFERENCES customers(id) ON DELETE CASCADE,
                CONSTRAINT fk_payment_request_package FOREIGN KEY (package_id) 
                    REFERENCES pppoe_packages(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Stores prepaid payment requests with unique codes (1 hour validity)'
        `);
        console.log('   ✅ payment_requests table created');

        // 4. Create prepaid_transactions table (for accounting/reporting)
        console.log('📝 Creating prepaid_transactions table...');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS prepaid_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                payment_request_id INT NULL,
                package_id INT NOT NULL,
                duration_days INT NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                payment_method VARCHAR(50) DEFAULT 'transfer' COMMENT 'transfer, qris, cash, etc',
                previous_expiry_date DATETIME NULL COMMENT 'Expiry before this purchase',
                new_expiry_date DATETIME NOT NULL COMMENT 'Expiry after this purchase',
                verified_by INT NULL COMMENT 'Admin user ID who verified (NULL = auto AI)',
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_customer_id (customer_id),
                INDEX idx_created_at (created_at),
                CONSTRAINT fk_prepaid_tx_customer FOREIGN KEY (customer_id) 
                    REFERENCES customers(id) ON DELETE CASCADE,
                CONSTRAINT fk_prepaid_tx_payment_req FOREIGN KEY (payment_request_id) 
                    REFERENCES payment_requests(id) ON DELETE SET NULL,
                CONSTRAINT fk_prepaid_tx_package FOREIGN KEY (package_id) 
                    REFERENCES pppoe_packages(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Transaction log for all prepaid package purchases (for accounting)'
        `);
        console.log('   ✅ prepaid_transactions table created');

        console.log('✅ Prepaid System Migration completed successfully!');
        console.log('');
        console.log('📋 Summary:');
        console.log('   - customers: added billing_mode, expiry_date');
        console.log('   - pppoe_packages: added price_7_days, price_30_days');
        console.log('   - payment_requests: created (for unique payment codes)');
        console.log('   - prepaid_transactions: created (for accounting/reports)');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        conn.release();
    }
}

// Auto-run if executed directly
if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('Migration script finished');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}
