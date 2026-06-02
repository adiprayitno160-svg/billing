"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
async function check() {
    try {
        const [rows] = await pool_1.databasePool.query('SHOW COLUMNS FROM payments');
        console.log("Columns found in payments table:");
        rows.forEach(row => {
            console.log(`- '${row.Field}'`);
        });
    }
    catch (err) {
        console.error("FAILURE:", err.message);
    }
    finally {
        await pool_1.databasePool.end();
    }
}
check();
//# sourceMappingURL=check-columns.js.map