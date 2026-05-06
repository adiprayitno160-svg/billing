const { databasePool } = require('../dist/db/pool');

async function run() {
    try {
        console.log('Shifting all invoices due on or before April 28th to Janji Bayar (April 30th)...');
        
        // Find invoices that are due on or before today (28th) and are still unpaid
        const [invoices] = await databasePool.execute(`
            SELECT i.id, i.customer_id, c.name, i.invoice_number, i.due_date, i.status
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE i.status IN ('overdue', 'unpaid', 'sent', 'partial')
            AND i.due_date <= '2026-04-28'
            AND i.remaining_amount > 0
            AND c.is_isolated = FALSE
        `);

        console.log(`Found ${invoices.length} invoices to shift.`);
        
        if (invoices.length > 0) {
            const ids = invoices.map(inv => inv.id);
            
            // Batch update status to janji_bayar and set due_date to 30th
            await databasePool.query(`
                UPDATE invoices 
                SET status = 'janji_bayar', 
                    due_date = '2026-04-30',
                    notes = CONCAT(IFNULL(notes, ''), ' [Batch Shifted to Janji Bayar 30 April by Admin Request]')
                WHERE id IN (?)
            `, [ids]);
            
            console.log('✅ Update successful. All targeted invoices are now set to Janji Bayar (April 30th).');
            
            // Log to console some examples
            console.log('Example updated customers:');
            invoices.slice(0, 5).forEach(inv => {
                console.log(`- ${inv.name} (Inv: ${inv.invoice_number}, Prev Due: ${inv.due_date})`);
            });
        } else {
            console.log('No invoices found matching the criteria (due <= 2026-04-28).');
        }
    } catch (e) {
        console.error('❌ Error during batch shift:', e);
    } finally {
        process.exit();
    }
}

run();
