
import { databasePool } from './src/db/pool';

async function test() {
    try {
        const [rows] = await databasePool.query('SELECT id, name FROM pppoe_profiles');
        console.log('PPPoE Profiles in DB:');
        console.table(rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await databasePool.end();
    }
}

test();
