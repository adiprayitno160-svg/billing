"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
async function repair() {
    try {
        console.log('Checking invoices table...');
        const conn = await pool_1.databasePool.getConnection();
        // Check if column exists
        const [columns] = await conn.query("SHOW COLUMNS FROM invoices LIKE 'last_payment_date'");
        if (columns.length === 0) {
            console.log('Adding last_payment_date to invoices table...');
            await conn.query("ALTER TABLE invoices ADD COLUMN last_payment_date DATETIME NULL AFTER status");
            console.log('Column added successfully.');
        }
        else {
            console.log('Column last_payment_date already exists.');
        }
        conn.release();
        console.log('Invoices table check completed.');
        process.exit(0);
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
repair();
//# sourceMappingURL=repair_invoices_table.js.map