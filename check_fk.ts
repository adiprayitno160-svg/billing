
import { databasePool } from './src/db/pool';

async function checkFK() {
    const conn = await databasePool.getConnection();
    try {
        const [rows]: any = await conn.query(`
            SELECT 
                TABLE_NAME, 
                COLUMN_NAME, 
                CONSTRAINT_NAME, 
                REFERENCED_TABLE_NAME, 
                REFERENCED_COLUMN_NAME
            FROM
                INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE
                REFERENCED_TABLE_NAME = 'customers'
                AND TABLE_SCHEMA = DATABASE();
        `);

        console.log('--- TABLES REFERENCING CUSTOMERS ---');
        console.log(JSON.stringify(rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

checkFK();
