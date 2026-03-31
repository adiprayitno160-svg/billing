
import { databasePool } from './src/db/pool';

async function listAprilData() {
    try {
        const period = '2026-04';
        console.log(`Checking data for period: ${period}`);

        const [invoices]: any = await databasePool.query(
            "SELECT i.id, i.invoice_number, i.customer_id, i.status, i.total_amount, i.paid_amount, i.remaining_amount, c.name as customer_name FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.period = ?",
            [period]
        );

        console.log(`Found ${invoices.length} invoices for April 2026.`);

        for (const inv of invoices) {
            const [payments]: any = await databasePool.query(
                "SELECT id, amount, payment_method, notes FROM payments WHERE invoice_id = ?",
                [inv.id]
            );
            
            console.log(`Invoice ${inv.invoice_number} (${inv.customer_name}): status=${inv.status}, total=${inv.total_amount}, paid=${inv.paid_amount}, remaining=${inv.remaining_amount}`);
            if (payments.length > 0) {
                console.log(`  Payments: ${payments.length}`);
                for (const p of payments) {
                    console.log(`    - ID: ${p.id}, Amount: ${p.amount}, Method: ${p.payment_method}, Notes: ${p.notes}`);
                }
            }

            // Check for carry-over mentions in other invoices
            const notePattern = `%[CARRIED OVER to Period ${period} Invoice ${inv.id}]%`;
            const [oldInvoices]: any = await databasePool.query(
                "SELECT id, invoice_number, period, notes FROM invoices WHERE notes LIKE ?",
                [notePattern]
            );

            if (oldInvoices.length > 0) {
                console.log(`  Carry-over from: ${oldInvoices.map((o: any) => `${o.invoice_number} (${o.period})`).join(', ')}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

listAprilData();
