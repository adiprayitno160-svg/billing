
import { databasePool } from './src/db/pool';

async function checkOLT() {
    try {
        const [olts] = await databasePool.query(
            "SELECT * FROM network_devices WHERE device_type = 'olt'"
        );
        console.log('OLTs found:', JSON.stringify(olts, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkOLT();
