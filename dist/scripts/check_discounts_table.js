"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
async function checkDiscounts() {
    try {
        const conn = await pool_1.databasePool.getConnection();
        const [columns] = await conn.query("SHOW COLUMNS FROM discounts");
        console.log(JSON.stringify(columns, null, 2));
        conn.release();
        process.exit(0);
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
checkDiscounts();
//# sourceMappingURL=check_discounts_table.js.map