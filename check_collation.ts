import { databasePool } from './src/db/pool';
import { RowDataPacket } from 'mysql2';

async function checkCollation() {
    try {
        const [rows] = await databasePool.query<RowDataPacket[]>(`
            SELECT TABLE_NAME, TABLE_COLLATION 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'billing'}'
        `);

        console.log('Table Collations:');
        rows.forEach(row => {
            console.log(`${row.TABLE_NAME}: ${row.TABLE_COLLATION}`);
        });

        // Also check connection collation
        const [vars] = await databasePool.query<RowDataPacket[]>("SHOW VARIABLES LIKE 'collation%'");
        console.log('\nConnection Variables:');
        console.log(vars);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkCollation();
