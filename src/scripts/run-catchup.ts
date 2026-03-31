import { IsolationService } from '../services/billing/isolationService';
import { databasePool } from '../db/pool';

async function runCatchUp() {
    console.log("Running Isolation/Restore Catch-Up...");
    try {
        const result = await (IsolationService as any).startupCatchUpIsolation();
        console.log("CATCH-UP RESULT:", JSON.stringify(result, null, 2));
    } catch (err: any) {
        console.error("FAILURE:", err.message);
    } finally {
        await databasePool.end();
    }
}

runCatchUp();
