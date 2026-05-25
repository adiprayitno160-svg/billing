require('dotenv').config();
const { databasePool } = require('./dist/db/pool.js');

async function run() {
    try {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS payment_confirmations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                invoice_id INT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                type ENUM('debt', 'janji_bayar') NOT NULL,
                status ENUM('pending', 'approved', 'expired', 'rejected') DEFAULT 'pending',
                due_date DATE DEFAULT NULL,
                notes TEXT,
                kasir_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        await databasePool.query(createTableQuery);
        console.log("Table payment_confirmations created successfully via app pool!");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit();
    }
}
run();
