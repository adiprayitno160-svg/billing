import { databasePool } from '../pool';

async function run() {
    const connection = await databasePool.getConnection();
    try {
        console.log('Creating customer_balance_logs table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS customer_balance_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                type ENUM('credit', 'debit') NOT NULL,
                description VARCHAR(255) NOT NULL,
                reference_id INT DEFAULT NULL,
                reference_type VARCHAR(50) DEFAULT NULL,
                created_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (customer_id),
                INDEX (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('Migration successful');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

run();
