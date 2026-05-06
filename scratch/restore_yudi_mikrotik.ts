import * as dotenv from 'dotenv';
dotenv.config();

// Ensure path mapping in typescript works
import { IsolationService } from './src/services/billing/isolationService';
import { databasePool } from './src/db/pool';

async function forceRestore() {
    console.log("Restoring customer 265...");
    try {
        await IsolationService.isolateCustomer({
            customer_id: 265,
            action: 'restore',
            reason: 'Tagihan bulan Maret sudah diubah menjadi hutang',
            performed_by: 'admin',
        });
        console.log("Successfully restored 265 and updated mikrotik!");
    } catch (e) {
        console.error("Failed:", e);
    } finally {
        await databasePool.end();
    }
}

forceRestore();
