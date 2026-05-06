const { databasePool } = require('../dist/db/pool');
async function run() {
    try {
        console.log('Final check for invoices due on or before April 28th...');
        const [rows] = await databasePool.execute(`
            SELECT i.id, i.due_date, i.status, c.name, i.invoice_number
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE i.remaining_amount > 0
            AND i.status != 'cancelled'
            AND i.due_date <= '2026-04-28'
        `);
        
        console.log(`Found ${rows.length} invoices.`);
        if (rows.length > 0) {
            const ids = rows.map(r => r.id);
            await databasePool.query("UPDATE invoices SET status = 'janji_bayar', due_date = '2026-04-30' WHERE id IN (?)", [ids]);
            console.log('✅ Successfully shifted all remaining candidate invoices to April 30th.');
            rows.forEach(r => console.log(`- ${r.name} (#${r.invoice_number})`));
        } else {
            console.log('No matching invoices found. All might have been shifted already.');
        }
    } catch (e) { console.error(e); } finally { process.exit(); }
}
run();
