import { databasePool } from '../db/pool';

async function migrate() {
    try {
        console.log('Starting migration for payment_deferments...');

        await databasePool.query(`
            CREATE TABLE IF NOT EXISTS payment_deferments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                invoice_id INT,
                requested_date DATE NOT NULL,
                deferred_until_date DATE NOT NULL,
                reason TEXT,
                status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
                count_in_year INT NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            )
        `);

        console.log('Table payment_deferments created or already exists.');

        // Add a column to customers table to track deferment status if needed, 
        // or we just query the deferments table.
        // Let's add a cached column for easier filtering
        const [columns] = await databasePool.query('SHOW COLUMNS FROM customers LIKE "is_deferred"');
        if (Array.isArray(columns) && columns.length === 0) {
            await databasePool.query('ALTER TABLE customers ADD COLUMN is_deferred BOOLEAN DEFAULT FALSE');
            console.log('Added is_deferred column to customers table.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
