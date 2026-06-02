"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const isolationService_1 = require("../services/billing/isolationService");
const pool_1 = require("../db/pool");
async function runCatchUp() {
    console.log("Running Isolation/Restore Catch-Up...");
    try {
        const result = await isolationService_1.IsolationService.startupCatchUpIsolation();
        console.log("CATCH-UP RESULT:", JSON.stringify(result, null, 2));
    }
    catch (err) {
        console.error("FAILURE:", err.message);
    }
    finally {
        await pool_1.databasePool.end();
    }
}
runCatchUp();
//# sourceMappingURL=run-catchup.js.map