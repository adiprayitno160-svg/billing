
const { databasePool } = require('./src/db/pool');

async function check() {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.query('SHOW FULL PROCESSLIST');
        console.log(JSON.stringify(rows.filter(r => r.Command !== 'Sleep' || r.Time > 10), null, 2));

        const [trxs] = await conn.query('SELECT * FROM information_schema.innodb_trx');
        console.log('Transactions:', JSON.stringify(trxs, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

check();
