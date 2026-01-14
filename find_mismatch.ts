import { databasePool } from './src/db/pool';
import { RowDataPacket } from 'mysql2';

async function findMismatchedTables() {
    try {
        const [rows] = await databasePool.query<RowDataPacket[]>(`
            SELECT TABLE_NAME, TABLE_COLLATION 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'billing'}'
            AND TABLE_COLLATION != 'utf8mb4_unicode_ci'
        `);

        if (rows.length > 0) {
            console.log('⚠️ Found tables with different collation:');
            rows.forEach(row => {
                console.log(`${row.TABLE_NAME}: ${row.TABLE_COLLATION}`);
            });
        } else {
            console.log('All tables seem to be utf8mb4_unicode_ci.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

findMismatchedTables();
