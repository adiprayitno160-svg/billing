import * as mysql from 'mysql2/promise';
import { IsolationService } from './src/services/billing/isolationService';

async function restoreManual() {
    const conn = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'billing'
    });
    
    try {
        console.log('Restoring Customer 839 with manual connection...');
        // Pass my manual connection to the service
        const result = await IsolationService.restoreIfQualified(839, conn as any);
        console.log('Restoration execution result:', result);
        
        await conn.end();
        process.exit(0);
    } catch (e: any) {
        console.error('Manual restoration failed:', e.message);
        console.error(e.stack);
        process.exit(1);
    }
}

restoreManual();
