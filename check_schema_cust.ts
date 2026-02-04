
import { databasePool } from './src/db/pool';
import { RowDataPacket } from 'mysql2';

async function checkSchema() {
    try {
        const [rows] = await databasePool.query<RowDataPacket[]>('DESCRIBE customers');
        console.log('Customers Columns: ', rows.map((r: any) => r.Field).join(', '));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSchema();
