const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    console.log('Connecting to database...');
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });

    try {
        console.log('Checking columns...');
        const [rows] = await pool.query("SHOW COLUMNS FROM customers LIKE 'account_balance'");

        if (rows.length === 0) {
            console.log('Adding account_balance column...');
            await pool.query("ALTER TABLE customers ADD COLUMN account_balance DECIMAL(15,2) DEFAULT 0.00 AFTER email");
            console.log('Column account_balance added successfully.');
        } else {
            console.log('Column account_balance already exists.');
        }

        // Also check if we need to add a transaction log table for balance history
        const [tables] = await pool.query("SHOW TABLES LIKE 'customer_balance_logs'");
        if (tables.length === 0) {
            console.log('Creating customer_balance_logs table...');
            await pool.query(`
                CREATE TABLE customer_balance_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    customer_id INT NOT NULL,
                    type ENUM('credit', 'debit') NOT NULL, -- credit = add to balance (overpayment), debit = use balance
                    amount DECIMAL(15,2) NOT NULL,
                    description TEXT,
                    reference_id INT, -- invoice_id or payment_id
                    reference_type VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
                )
            `);
            console.log('Table customer_balance_logs created.');
        } else {
            console.log('Table customer_balance_logs already exists.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
        process.exit();
    }
}
main();
