const { databasePool } = require('../dist/db/pool');
async function run() {
    try {
        console.log('Searching for unpaid/overdue/sent/partial invoices...');
        const [rows] = await databasePool.execute(`
            SELECT i.id, i.due_date, i.status, i.invoice_number, c.name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE i.status IN ('overdue', 'unpaid', 'sent', 'partial')
            AND i.remaining_amount > 0
        `);
        
        console.log(`Total found: ${rows.length}`);
        rows.forEach(r => {
            const d = new Date(r.due_date);
            const dateStr = d.toISOString().split('T')[0];
            console.log(`ID: ${r.id}, Due: ${dateStr}, Status: ${r.status}, Cust: ${r.name}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
