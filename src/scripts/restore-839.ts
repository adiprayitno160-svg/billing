import { IsolationService } from '../services/billing/isolationService';
import { databasePool } from '../db/pool';

import * as IS from '../services/billing/isolationService';
async function restore() {
    console.log("IS keys:", Object.keys(IS));
    console.log("Type of IsolationService:", typeof IsolationService);
    // Use getOwnPropertyNames for classes
    console.log("IsolationService members:", Object.getOwnPropertyNames(IsolationService));
    console.log("Restoring Customer 839...");
    try {
        const result = await (IsolationService as any).restoreIfQualified(839);
        console.log("RESTORE RESULT:", result);
    } catch (err: any) {
        console.error("FAILURE:", err.message);
    } finally {
        await databasePool.end();
    }
}

restore();
