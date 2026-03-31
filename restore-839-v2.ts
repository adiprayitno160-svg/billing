import { IsolationService } from './src/services/billing/isolationService';
import { databasePool } from './src/db/pool';

async function restore() {
    console.log('--- RESTORE 839 LOG ---');
    try {
        const [rows] = await databasePool.query<any[]>(
            "SELECT id, name, is_isolated FROM customers WHERE id = 839"
        );
        console.log('Query raw result:', JSON.stringify(rows));
        
        if (rows.length === 0) {
            console.error('Customer 839 not found in DB!');
            process.exit(1);
        }

        const customer = rows[0];
        console.log(`Customer: ${customer.name} (Isolated: ${customer.is_isolated})`);
        
        if (!customer.is_isolated) {
            console.log('Customer already NOT isolated.');
            process.exit(0);
        }

        console.log('Attempting restoreIfQualified...');
        const result = await IsolationService.restoreIfQualified(839);
        console.log('Restore execution result:', result);
        
        // Check final status
        const [rows2] = await databasePool.query<any[]>(
            "SELECT is_isolated FROM customers WHERE id = 839"
        );
        console.log('Final is_isolated status:', rows2[0].is_isolated);
        
        process.exit(0);
    } catch (e: any) {
        console.error('ERROR during restore test:', e.message);
        console.error(e.stack);
        process.exit(1);
    }
}

restore();
