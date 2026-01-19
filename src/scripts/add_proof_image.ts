
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

async function migrate() {
    console.log('🚀 Starting Migration: Add proof_image to payments and prepaid_transactions...');

    const connection = await mysql.createConnection({
        host: DB_HOST || 'localhost',
        user: DB_USER || 'root',
        password: DB_PASSWORD || '',
        database: DB_NAME
    });

    try {
        // 1. Add proof_image to payments table if not exists
        try {
            await connection.query(`ALTER TABLE payments ADD COLUMN proof_image VARCHAR(255) DEFAULT NULL AFTER notes`);
            console.log('✅ Added proof_image to payments table.');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ payments.proof_image already exists.');
            } else {
                throw e;
            }
        }

        // 2. Create prepaid_transactions table if not exists (since I couldn't find it easily)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS prepaid_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NULL,
                customer_name VARCHAR(191),
                phone VARCHAR(50),
                package_code VARCHAR(50),
                package_name VARCHAR(191),
                amount DECIMAL(15,2),
                voucher_code VARCHAR(50),
                payment_method VARCHAR(50) DEFAULT 'transfer',
                payment_status ENUM('pending', 'verified', 'failed') DEFAULT 'pending',
                proof_image VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                verified_by INT NULL,
                notes TEXT
            )
        `);
        console.log('✅ Ensured prepaid_transactions table exists.');

        // 3. Add proof_image to prepaid_transactions if missing (for existing table)
        try {
            await connection.query(`ALTER TABLE prepaid_transactions ADD COLUMN proof_image VARCHAR(255) DEFAULT NULL`);
            console.log('✅ Added proof_image to prepaid_transactions table.');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ️ prepaid_transactions.proof_image already exists.');
        }

    } catch (error) {
        console.error('❌ Migration Failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
