"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
async function test() {
    console.log("Checking databasePool state...");
    try {
        const conn = await pool_1.databasePool.getConnection();
        console.log("SUCCESS: Connection obtained.");
        await conn.ping();
        console.log("SUCCESS: Ping successful.");
        conn.release();
    }
    catch (err) {
        console.error("FAILURE:", err.message);
        if (err.message.includes("closed")) {
            console.error("THE POOL IS DEFINITIVELY CLOSED.");
        }
    }
}
test();
//# sourceMappingURL=check-pool.js.map