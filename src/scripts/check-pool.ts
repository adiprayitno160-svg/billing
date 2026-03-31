import { databasePool } from '../db/pool';

async function test() {
    console.log("Checking databasePool state...");
    try {
        const conn = await databasePool.getConnection();
        console.log("SUCCESS: Connection obtained.");
        await conn.ping();
        console.log("SUCCESS: Ping successful.");
        conn.release();
    } catch (err: any) {
        console.error("FAILURE:", err.message);
        if (err.message.includes("closed")) {
            console.error("THE POOL IS DEFINITIVELY CLOSED.");
        }
    }
}

test();
