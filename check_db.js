
const { databasePool } = require('./dist/db/pool');
async function check() {
    try {
        const [rows] = await databasePool.query('SHOW TABLES LIKE "payment_proofs"');
        console.log('Payment Proofs exists:', rows.length > 0);
        
        const [users] = await databasePool.query('DESC users');
        console.log('Users columns:', users.map(u => u.Field).join(', '));
        
        const [payments] = await databasePool.query('SELECT count(*) as count FROM payments');
        console.log('Payments count:', payments[0].count);
        
        const [history] = await databasePool.query(`
            SELECT p.* FROM payments p
            LEFT JOIN invoices i ON p.invoice_id = i.id
            LEFT JOIN customers c ON i.customer_id = c.id
            LIMIT 1
        `);
        console.log('History query works:', history.length > 0);
    } catch (e) {
        console.error('ERROR:', e.message);
    }
    process.exit();
}
check();
