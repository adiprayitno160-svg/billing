
const { databasePool } = require('./src/db/pool');

async function check() {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.query('SHOW TABLES LIKE "customer_compensations"');
        console.log('Table exists:', rows.length > 0);
        if (rows.length > 0) {
            const [cols] = await conn.query('DESCRIBE customer_compensations');
            console.log(JSON.stringify(cols, null, 2));
        }
    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

check();
