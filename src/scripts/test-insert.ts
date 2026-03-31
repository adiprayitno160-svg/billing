import { databasePool } from '../db/pool';

async function test() {
    try {
        console.log("Testing insert into payments with kasir_name...");
        const [result] = await databasePool.execute(
            'INSERT INTO payments (invoice_id, payment_method, amount, payment_date, notes, kasir_name) VALUES (?, ?, ?, ?, ?, ?)',
            [847, 'cash', 0.01, new Date().toISOString().slice(0, 10), 'DEBUG TEST', 'admin']
        );
        console.log("SUCCESS! Row inserted. ID:", (result as any).insertId);
    } catch (err: any) {
        console.error("FAILURE:", err.message);
    } finally {
        await databasePool.end();
    }
}

test();
