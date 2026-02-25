
const { databasePool } = require('./src/db/pool');

async function migrate() {
    const conn = await databasePool.getConnection();
    try {
        console.log('Starting migration...');

        // Ensure discounts table exists
        await conn.query(`CREATE TABLE IF NOT EXISTS discounts (
			id INT AUTO_INCREMENT PRIMARY KEY,
			invoice_id INT NOT NULL,
			discount_type ENUM('sla', 'manual', 'other', 'disturbance') DEFAULT 'manual',
			discount_value DECIMAL(12,2) NOT NULL,
			reason TEXT,
			applied_by INT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_invoice_id (invoice_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

        // Rename amount to discount_value if it exists
        const [cols] = await conn.query("SHOW COLUMNS FROM discounts LIKE 'amount'");
        if (Array.isArray(cols) && cols.length > 0) {
            console.log('Renaming amount to discount_value...');
            await conn.query(`ALTER TABLE discounts CHANGE COLUMN amount discount_value DECIMAL(12,2) NOT NULL`);
        }

        // Add applied_by if it doesn't exist
        const [cols2] = await conn.query("SHOW COLUMNS FROM discounts LIKE 'applied_by'");
        if (Array.isArray(cols2) && cols2.length === 0) {
            console.log('Adding applied_by column...');
            await conn.query(`ALTER TABLE discounts ADD COLUMN applied_by INT NULL AFTER reason`);
        }

        // Update enum
        console.log('Updating discount_type enum...');
        await conn.query(`ALTER TABLE discounts MODIFY COLUMN discount_type ENUM('sla', 'manual', 'other', 'disturbance') DEFAULT 'manual'`);

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        conn.release();
        process.exit();
    }
}

migrate();
