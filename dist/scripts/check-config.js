"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
async function check() {
    // @ts-ignore
    console.log("Pool Config Database:", pool_1.databasePool.pool.config.connectionConfig.database);
    // @ts-ignore
    console.log("Pool Config Host:", pool_1.databasePool.pool.config.connectionConfig.host);
    await pool_1.databasePool.end();
}
check();
//# sourceMappingURL=check-config.js.map