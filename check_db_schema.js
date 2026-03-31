const { databasePool } = require('./src/db/pool');

async function checkSchema() {
    const conn = await databasePool.getConnection();
    try {
        const [payments] = await conn.query('DESCRIBE payments');
        console.log('PAYMENTS SCHEMA:');
        console.table(payments);

        const [invoices] = await conn.query('DESCRIBE invoices');
        console.log('\nINVOICES SCHEMA:');
        console.table(invoices);
    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit(0);
    }
}

checkSchema();
