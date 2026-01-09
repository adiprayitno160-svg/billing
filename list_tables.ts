
import { databasePool } from './src/db/pool';

async function listTables() {
    try {
        const [rows] = await databasePool.query('SHOW TABLES');
        console.log('Tables:');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
}

listTables();
