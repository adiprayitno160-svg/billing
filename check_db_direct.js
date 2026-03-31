
const mysql = require('mysql2/promise');
const config = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'billing'
};

async function check() {
    const conn = await mysql.createConnection(config);
    try {
        const [rows] = await conn.query('SHOW TABLES LIKE "payment_proofs"');
        console.log('Payment Proofs exists:', rows.length > 0);
        
        const [users] = await conn.query('DESC users');
        console.log('Users columns:', users.map(u => u.Field).join(', '));
        
        const [payments] = await conn.query('SELECT count(*) as count FROM payments');
        console.log('Payments count:', payments[0].count);
        
        const [history] = await conn.query(`
            SELECT p.id FROM payments p
            LEFT JOIN invoices i ON p.invoice_id = i.id
            LEFT JOIN customers c ON i.customer_id = c.id
            LIMIT 1
        `);
        console.log('History query works:', history.length > 0);
    } catch (e) {
        console.error('ERROR:', e.message);
    }
    await conn.end();
}
check();
