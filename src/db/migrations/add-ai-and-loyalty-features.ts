import { databasePool } from '../pool';
import { RowDataPacket } from 'mysql2';

/**
 * Migration: Add AI Knowledge Base and Loyalty/Referral tables
 */
export async function runNewFeatureMigration(): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
        console.log('🚀 Starting New Features Migration...');

        // 1. AI Knowledge Base Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS ai_knowledge_base (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category VARCHAR(100) NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                tags VARCHAR(255) NULL,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FULLTEXT INDEX idx_qa (question, answer)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Created ai_knowledge_base table');

        // 2. Update customers table for Loyalty & Referral
        const [customerColumns] = await conn.query<RowDataPacket[]>('SHOW COLUMNS FROM customers');
        const columnNames = customerColumns.map((col: any) => col.Field);

        if (!columnNames.includes('referral_code')) {
            await conn.query('ALTER TABLE customers ADD COLUMN referral_code VARCHAR(10) UNIQUE AFTER pppoe_password');
            console.log('✅ Added referral_code to customers');
        }

        if (!columnNames.includes('referred_by_id')) {
            await conn.query('ALTER TABLE customers ADD COLUMN referred_by_id INT NULL AFTER referral_code');
            await conn.query('ALTER TABLE customers ADD CONSTRAINT fk_referred_by FOREIGN KEY (referred_by_id) REFERENCES customers(id) ON DELETE SET NULL');
            console.log('✅ Added referred_by_id to customers');
        }

        if (!columnNames.includes('loyalty_points')) {
            await conn.query('ALTER TABLE customers ADD COLUMN loyalty_points INT DEFAULT 0 AFTER referred_by_id');
            console.log('✅ Added loyalty_points to customers');
        }

        // 3. Loyalty Transactions Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS loyalty_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                points INT NOT NULL,
                transaction_type ENUM('earn', 'redeem', 'referral_bonus') NOT NULL,
                description VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_loyalty_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Created loyalty_transactions table');

        // 4. Populate unique referral codes for existing customers
        const [customers] = await conn.query<RowDataPacket[]>('SELECT id FROM customers WHERE referral_code IS NULL');
        for (const customer of customers) {
            const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            await conn.query('UPDATE customers SET referral_code = ? WHERE id = ?', [referralCode, customer.id]);
        }
        console.log(`✅ Generated referral codes for ${customers.length} customers`);

        console.log('🎉 New Features Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        conn.release();
    }
}
