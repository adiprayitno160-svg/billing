import { IsolationService } from './src/services/billing/isolationService';
import { databasePool } from './src/db/pool';

async function restore() {
    try {
        console.log('Checking restoration for Customer 839...');
        const result = await IsolationService.restoreIfQualified(839);
        console.log('Restoration result:', result);
        
        const [customer] = await databasePool.query<any[]>(
            "SELECT is_isolated FROM customers WHERE id = 839"
        );
        console.log('Customer 839 is_isolated status:', customer[0].is_isolated);
        
        process.exit(0);
    } catch (error: any) {
        console.error('Restoration failed:', error.message);
        process.exit(1);
    }
}

restore();
