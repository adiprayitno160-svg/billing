import { databasePool } from '../db/pool';

async function check() {
    // @ts-ignore
    console.log("Pool Config Database:", databasePool.pool.config.connectionConfig.database);
    // @ts-ignore
    console.log("Pool Config Host:", databasePool.pool.config.connectionConfig.host);
    await databasePool.end();
}

check();
