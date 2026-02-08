const { databasePool } = require('./src/db/pool');

async function runMigration() {
    try {
        const connection = await databasePool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS customer_compensations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                duration_days INT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                notes TEXT,
                status ENUM('pending', 'applied', 'cancelled') DEFAULT 'pending',
                applied_invoice_id INT DEFAULT NULL,
                created_by INT DEFAULT NULL,
                applied_at DATETIME DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_status (status),
                INDEX idx_customer (customer_id),
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (applied_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
            );
        `);
        console.log('Migration successful');
        connection.release();
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
