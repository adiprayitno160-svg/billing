
import { databasePool } from './src/db/pool';

async function debugMapData() {
    try {
        console.log('--- Checking Customer "ASEM" ---');
        const [customers] = await databasePool.query(
            "SELECT id, name, status, latitude, longitude, updated_at FROM customers WHERE name LIKE '%ASEM%'"
        );
        console.log('In `customers` table:', JSON.stringify(customers, null, 2));

        const [deviceAsem] = await databasePool.query(
            "SELECT id, name, device_type, status, latitude, longitude, updated_at, customer_id FROM network_devices WHERE name LIKE '%ASEM%'"
        );
        console.log('In `network_devices` table:', JSON.stringify(deviceAsem, null, 2));


        console.log('\n--- Checking ODC "DEPAN BALAI DESA" ---');
        const [odc] = await databasePool.query(
            "SELECT id, name, latitude, longitude FROM ftth_odc WHERE name LIKE '%DEPAN BALAI DESA%'"
        );
        console.log('In `ftth_odc` table:', JSON.stringify(odc, null, 2));

        const [deviceOdc] = await databasePool.query(
            "SELECT id, name, device_type, status, latitude, longitude, odc_id FROM network_devices WHERE name LIKE '%DEPAN BALAI DESA%'"
        );
        console.log('In `network_devices` table:', JSON.stringify(deviceOdc, null, 2));

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

debugMapData();
