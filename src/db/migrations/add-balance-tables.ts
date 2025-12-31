import { databasePool } from '../pool';

export async function addBalanceTables(): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
        // Add account_balance to customers if not exists
        // Check if column exists first to avoid error
        const [columns] = await conn.query("SHOW COLUMNS FROM customers LIKE 'account_balance'") as any;

        if (columns.length === 0) {
            await conn.query(`
                ALTER TABLE customers 
                ADD COLUMN account_balance DECIMAL(15,2) DEFAULT 0.00 AFTER address
            `);
            console.log('✅ Added account_balance column to customers table');
        } else {
            console.log('ℹ️ account_balance column already exists in customers table');
        }

        // Create customer_balance_logs table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS customer_balance_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                type ENUM('credit', 'debit') NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                description TEXT NULL,
                reference_id VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_customer_id (customer_id),
                INDEX idx_created_at (created_at),
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Created customer_balance_logs table');

    } catch (error) {
        console.error('❌ Error adding balance tables:', error);
        throw error;
    } finally {
        conn.release();
    }
}

// Auto-run if executed directly
if (require.main === module) {
    addBalanceTables()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
