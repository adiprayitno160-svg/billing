"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
async function migrate() {
    try {
        console.log('Creating discounts table...');
        const conn = await pool_1.databasePool.getConnection();
        await conn.query(`
            CREATE TABLE IF NOT EXISTS discounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_id INT NOT NULL,
                discount_type ENUM('sla', 'manual', 'other') DEFAULT 'manual',
                amount DECIMAL(10,2) NOT NULL,
                percentage DECIMAL(5,2),
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_invoice_id (invoice_id),
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('discounts table created successfully.');
        conn.release();
        process.exit(0);
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
migrate();
//# sourceMappingURL=create_discounts_table.js.map