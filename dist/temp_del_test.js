"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./db/pool");
const staticIpPackageService_1 = require("./services/staticIpPackageService");
async function main() {
    try {
        const [result] = await pool_1.databasePool.execute(`INSERT INTO static_ip_packages (name, max_limit_upload, max_limit_download, max_clients, price, duration_days, status) 
             VALUES ('TEST_DELETE_PKG', '1M', '1M', 10, 50000, 30, 'active')`);
        const newId = result.insertId;
        console.log("Created empty pkg", newId);
        console.log(`Attempting to delete package TEST_DELETE_PKG (${newId})...`);
        await (0, staticIpPackageService_1.deleteStaticIpPackage)(newId);
        console.log("DELETED SUCCESSFULLY!");
    }
    catch (e) {
        console.error("ERROR DELETING:", e.message);
    }
    finally {
        process.exit();
    }
}
main();
//# sourceMappingURL=temp_del_test.js.map