"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
async function test() {
    try {
        console.log("Testing insert into payments with kasir_name...");
        const [result] = await pool_1.databasePool.execute('INSERT INTO payments (invoice_id, payment_method, amount, payment_date, notes, kasir_name) VALUES (?, ?, ?, ?, ?, ?)', [847, 'cash', 0.01, new Date().toISOString().slice(0, 10), 'DEBUG TEST', 'admin']);
        console.log("SUCCESS! Row inserted. ID:", result.insertId);
    }
    catch (err) {
        console.error("FAILURE:", err.message);
    }
    finally {
        await pool_1.databasePool.end();
    }
}
test();
//# sourceMappingURL=test-insert.js.map