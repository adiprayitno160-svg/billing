
import { databasePool } from './src/db/pool';
import { RowDataPacket } from 'mysql2';

async function checkTableSizes() {
    try {
        console.log('Checking table sizes...');
        const [rows] = await databasePool.query<RowDataPacket[]>(`
            SELECT 
                table_name AS "Table", 
                ROUND(((data_length + index_length) / 1024 / 1024), 2) AS "Size (MB)" 
            FROM information_schema.TABLES 
            WHERE table_schema = (SELECT DATABASE()) 
            ORDER BY (data_length + index_length) DESC;
        `);

        console.table(rows);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkTableSizes();
