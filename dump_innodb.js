
const { databasePool } = require('./src/db/pool');

async function check() {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.query('SHOW ENGINE INNODB STATUS');
        console.log(rows[0].Status);
    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

check();
