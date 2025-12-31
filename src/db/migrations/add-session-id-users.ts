import { databasePool } from '../pool';

async function run() {
    const connection = await databasePool.getConnection();
    try {
        console.log('Adding session_id column to users table...');
        await connection.query('ALTER TABLE users ADD COLUMN session_id VARCHAR(255) NULL');
        console.log('Migration successful');
    } catch (error) {
        // Ignore if column exists
        if ((error as any).code === 'ER_DUP_FIELDNAME') {
            console.log('Column session_id already exists.');
        } else {
            console.error('Migration failed:', error);
        }
    } finally {
        connection.release();
        process.exit();
    }
}

run();
