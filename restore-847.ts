import { IsolationService } from './src/services/billing/isolationService';
import { databasePool } from './src/db/pool';

async function restore() {
    console.log('IsolationService methods:', Object.keys(IsolationService));
    try {
        console.log('Checking restoration for Customer 847...');
        const result = await IsolationService.restoreIfQualified(847);
        console.log('Restoration result:', result);
        
        const [customer] = await databasePool.query<any[]>(
            "SELECT is_isolated FROM customers WHERE id = 847"
        );
        console.log('Customer 847 is_isolated status:', customer[0].is_isolated);
        
        process.exit(0);
    } catch (error: any) {
        console.error('Restoration failed:', error.message);
        process.exit(1);
    }
}

restore();
