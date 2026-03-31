const { databasePool } = require('./src/db/pool');

async function checkMarchInvoices() {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.query(`
            SELECT status, COUNT(*) as count 
            FROM invoices 
            WHERE period = '2026-03' 
            GROUP BY status
        `);
        console.log('MARCH 2026 INVOICE STATUS:');
        console.table(rows);

        const [activeCustomers] = await conn.query('SELECT COUNT(*) as count FROM customers WHERE status = "active"');
        console.log('TOTAL ACTIVE CUSTOMERS:', activeCustomers[0].count);

        const [missingInvoices] = await conn.query(`
            SELECT COUNT(*) as count FROM customers c
            WHERE c.status = 'active'
            AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.customer_id = c.id AND i.period = '2026-03')
        `);
        console.log('ACTIVE CUSTOMERS MISSING MARCH INVOICE:', missingInvoices[0].count);

    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit(0);
    }
}

checkMarchInvoices();
