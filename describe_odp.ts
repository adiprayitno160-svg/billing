import { databasePool } from './src/db/pool';

async function describeTable() {
    try {
        const [rows] = await databasePool.query('DESCRIBE ftth_odp');
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

describeTable();
