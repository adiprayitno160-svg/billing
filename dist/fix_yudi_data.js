"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./db/pool");
const fs_1 = __importDefault(require("fs"));
async function main() {
    console.log("Starting query for Yudi...");
    // Let's find customer first to be sure
    const [customers] = await pool_1.databasePool.query('SELECT id, name FROM customers WHERE name LIKE "%Yudi%"');
    console.log("Customers found:", customers);
    const [invoices] = await pool_1.databasePool.query('SELECT * FROM invoices WHERE customer_id = 55');
    console.log("Invoices found for ID 55:", invoices.length);
    const data = {
        customers,
        invoices
    };
    fs_1.default.writeFileSync('yudi_debug_results.json', JSON.stringify(data, null, 2));
    console.log("Results written to yudi_debug_results.json");
    // Check Feb 2026 specifically
    const [feb] = await pool_1.databasePool.query('SELECT * FROM invoices WHERE customer_id = 55 AND period = "2026-02"');
    console.log("Feb 2026 Invoice:", feb);
    await pool_1.databasePool.end();
}
main().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
//# sourceMappingURL=fix_yudi_data.js.map