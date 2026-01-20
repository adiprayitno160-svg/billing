import { databasePool } from './src/db/pool';

async function describeTables() {
    try {
        const tables = ['ftth_olt', 'ftth_odc', 'ftth_odp', 'ftth_ont'];
        for (const table of tables) {
            try {
                const [rows] = await databasePool.query(`DESCRIBE ${table}`);
                console.log(`Table ${table}:`);
                console.log(JSON.stringify(rows, null, 2));
            } catch (e) {
                console.log(`Table ${table} does not exist or error:`, e.message);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

describeTables();
