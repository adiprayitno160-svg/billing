const mysql = require('mysql2/promise');

async function countApril() {
    const pool = mysql.createPool({host:'localhost', user:'root', password:'', database:'billing'});
    try {
        const [subs] = await pool.query(`SELECT COUNT(*) as aktif FROM subscriptions s JOIN customers c ON s.customer_id = c.id WHERE s.status = 'active' AND c.status = 'active'`);
        const [blm] = await pool.query(`SELECT COUNT(*) as sisa FROM subscriptions s JOIN customers c ON s.customer_id = c.id WHERE s.status = 'active' AND c.status = 'active' AND s.id NOT IN (SELECT DISTINCT subscription_id FROM invoices WHERE period = '2026-04' AND subscription_id IS NOT NULL)`);
        
        console.log('TOTAL SEMUA PELANGGAN AKTIF:', subs[0].aktif);
        console.log('SISA PELANGGAN YG BELOM DICETAK INVOICE APRIL:', blm[0].sisa);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
countApril();
