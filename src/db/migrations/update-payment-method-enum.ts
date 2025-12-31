import { databasePool } from '../pool';

async function run() {
    const connection = await databasePool.getConnection();
    try {
        console.log('Updating payments.payment_method enum...');
        await connection.query("ALTER TABLE payments MODIFY COLUMN payment_method ENUM('cash','transfer','gateway','qris','other','balance') NOT NULL");
        console.log('Migration successful');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

run();
