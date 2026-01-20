import { databasePool } from './src/db/pool';

async function listTables() {
    try {
        const [rows] = await databasePool.query('SHOW TABLES');
        console.log('Tables in database:');
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error listing tables:', error);
    } finally {
        process.exit();
    }
}

listTables();
