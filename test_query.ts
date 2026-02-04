
import { databasePool } from './src/db/pool';
import { RowDataPacket } from 'mysql2';

async function testQuery() {
    try {
        console.log('Running query...');
        const [history] = await databasePool.query<RowDataPacket[]>(`
            SELECT wbm.*, c.name as customer_name 
            FROM whatsapp_bot_messages wbm
            LEFT JOIN customers c ON wbm.customer_id = c.id
            ORDER BY wbm.created_at DESC
            LIMIT 10
        `);
        console.log('Query success:', history.length);
        process.exit(0);
    } catch (error: any) {
        console.error('Query failed:', error.message);
        process.exit(1);
    }
}

testQuery();
