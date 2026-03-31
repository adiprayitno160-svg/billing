
const { databasePool } = require('./src/db/pool');

async function migrate() {
    const conn = await databasePool.getConnection();
    try {
        console.log('Adding loyalty_discount to customers...');
        try {
            await conn.execute('ALTER TABLE customers ADD COLUMN loyalty_discount DECIMAL(15,2) DEFAULT 0');
        } catch (e) {
            console.log('loyalty_discount probably already exists.');
        }
        
        console.log('Adding auto_pay_enabled to customers...');
        try {
            await conn.execute('ALTER TABLE customers ADD COLUMN auto_pay_enabled BOOLEAN DEFAULT FALSE');
        } catch (e) {
            console.log('auto_pay_enabled probably already exists.');
        }

        console.log('Migration completed');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
