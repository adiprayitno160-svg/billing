const mysql = require('mysql2/promise');
require('dotenv').config();
async function run() {
    const conn = await mysql.createConnection({
        host: '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing',
        port: parseInt(process.env.DB_PORT) || 3306
    });
    
    // Create the payment_confirmations table
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
        );
    `;
    
    await conn.query(createTableQuery);
    console.log("Table payment_confirmations created successfully!");
    conn.end();
}
run();
