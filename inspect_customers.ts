import { databasePool } from './src/db/pool';

async function inspect() {
    try {
        console.log("--- INSPECTING KOKOM & AGUS ---");
        const [customers] = await databasePool.execute(
            'SELECT id, name, customer_code FROM customers WHERE name LIKE "%YUNUS%" OR name LIKE "%KOKOM%" OR name LIKE "%AGUS%"'
        );
        
        const custs = customers as any[];
        if (custs.length === 0) {
            console.log("No customers found.");
            return;
        }

        for (const c of custs) {
            console.log(`\n👤 Customer: ${c.name} (ID: ${c.id}, Code: ${c.customer_code})`);
            const [invoices] = await databasePool.execute(
                'SELECT id, period, total_amount, paid_amount, remaining_amount, status FROM invoices WHERE customer_id = ? AND period IN ("2026-03", "2026-04") ORDER BY period DESC',
                [c.id]
            );
            console.log("March & April Invoices:");
            console.table(invoices);
            
            const [payments] = await databasePool.execute(
                'SELECT p.id, p.amount, p.payment_date, p.payment_method, p.notes, i.period as invoice_period FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.customer_id = ? ORDER BY p.created_at DESC LIMIT 5',
                [c.id]
            );
            console.log("Recent Payments:");
            console.table(payments);
        }

    } catch (err: any) {
        console.error("FAILURE:", err.message);
    } finally {
        await databasePool.end();
    }
}

inspect();
