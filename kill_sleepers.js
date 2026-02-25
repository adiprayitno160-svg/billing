
const { databasePool } = require('./src/db/pool');

async function check() {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.query('SHOW FULL PROCESSLIST');
        for (const row of rows) {
            if (row.Command === 'Sleep' && row.Time > 3600) {
                console.log(`Killing process ${row.Id} (Time: ${row.Time})`);
                await conn.query(`KILL ${row.Id}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

check();
