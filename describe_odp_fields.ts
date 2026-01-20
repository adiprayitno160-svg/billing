import { databasePool } from './src/db/pool';

async function describeTable() {
    try {
        const [rows] = await databasePool.query('DESCRIBE ftth_odp');
        (rows as any[]).slice(0, 10).forEach(r => console.log(r.Field));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

describeTable();
