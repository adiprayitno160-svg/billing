import { databasePool } from '../pool';

async function run() {
    const connection = await databasePool.getConnection();
    try {
        console.log('Modifying email column to be nullable...');
        await connection.query('ALTER TABLE customers MODIFY email VARCHAR(255) NULL');
        console.log('Migration successful');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

run();
