
const { databasePool } = require('./src/db/pool');

async function check() {
    const conn = await databasePool.getConnection();
    try {
        console.log('Testing lock on invoice 513...');
        await conn.execute('SELECT * FROM invoices WHERE id = 513 FOR UPDATE');
        console.log('Lock acquired successfully!');
    } catch (err) {
        console.error('Failed to acquire lock:', err.message);
    } finally {
        conn.release();
        process.exit();
    }
}

check();
