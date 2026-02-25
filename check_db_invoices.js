
const { databasePool } = require('./src/db/pool');

async function check() {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.query('DESCRIBE invoices');
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

check();
