import { databasePool } from './src/db/pool';

async function checkDevices() {
    try {
        const [rows] = await databasePool.query('SELECT id, device_type, name, latitude, longitude FROM network_devices');
        console.log('Network Devices:');
        console.log(JSON.stringify(rows, null, 2));

        const [links] = await databasePool.query('SELECT * FROM network_links');
        console.log('Network Links:');
        console.log(JSON.stringify(links, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkDevices();
