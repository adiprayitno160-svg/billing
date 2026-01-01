const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixTable() {
    console.log('Connecting to database...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    });

    console.log('Connected. Creating table bandwidth_logs...');

    await connection.execute(`
        CREATE TABLE IF NOT EXISTS bandwidth_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            bytes_in BIGINT DEFAULT 0,
            bytes_out BIGINT DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_customer_timestamp (customer_id, timestamp),
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Table bandwidth_logs created successfully!');
    await connection.end();
}

fixTable().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
