import { databasePool } from '../db/pool';

async function checkState() {
    console.log("Checking customer and invoice states...");
    const conn = await databasePool.getConnection();
    try {
        // Find Lalak Yuhandifa
        const [lalakRows]: any = await conn.query(
            "SELECT id, name, status, is_isolated, isolation_enabled FROM customers WHERE name LIKE '%Lalak%'"
        );
        console.log("\n=== Lalak Yuhandifa ===");
        if (lalakRows.length > 0) {
            for (const r of lalakRows) {
                console.log(`Customer ID: ${r.id}, Name: ${r.name}, Status: ${r.status}, Is Isolated: ${r.is_isolated}, Isolation Enabled: ${r.isolation_enabled}`);
                const [subs]: any = await conn.query("SELECT id, status FROM subscriptions WHERE customer_id = ?", [r.id]);
                console.log("Subscriptions:", subs);
                const [invs]: any = await conn.query("SELECT id, invoice_number, period, total_amount, remaining_amount, status FROM invoices WHERE customer_id = ? ORDER BY period DESC", [r.id]);
                console.log("Invoices:", invs);
            }
        } else {
            console.log("Lalak Yuhandifa not found.");
        }

        // Find Bu Nanik
        const [nanikRows]: any = await conn.query(
            "SELECT id, name, status, is_isolated, isolation_enabled FROM customers WHERE name LIKE '%Nanik%'"
        );
        console.log("\n=== Bu Nanik ===");
        if (nanikRows.length > 0) {
            for (const r of nanikRows) {
                console.log(`Customer ID: ${r.id}, Name: ${r.name}, Status: ${r.status}, Is Isolated: ${r.is_isolated}, Isolation Enabled: ${r.isolation_enabled}`);
                const [subs]: any = await conn.query("SELECT id, status FROM subscriptions WHERE customer_id = ?", [r.id]);
                console.log("Subscriptions:", subs);
                const [invs]: any = await conn.query("SELECT id, invoice_number, period, total_amount, remaining_amount, status FROM invoices WHERE customer_id = ? ORDER BY period DESC", [r.id]);
                console.log("Invoices:");
                for (const inv of invs) {
                    console.log(`  Inv ID: ${inv.id}, Num: ${inv.invoice_number}, Period: ${inv.period}, Total: ${inv.total_amount}, Remaining: ${inv.remaining_amount}, Status: ${inv.status}`);
                    const [items]: any = await conn.query("SELECT id, description, unit_price, total_price FROM invoice_items WHERE invoice_id = ?", [inv.id]);
                    for (const item of items) {
                        console.log(`    Item ID: ${item.id}, Desc: ${item.description}, UnitPrice: ${item.unit_price}, TotalPrice: ${item.total_price}`);
                    }
                }
            }
        } else {
            console.log("Bu Nanik not found.");
        }
    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        conn.release();
        await databasePool.end();
    }
}

checkState();
