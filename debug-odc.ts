
import { databasePool } from './src/db/pool';

async function checkODC() {
    try {
        const [odcs] = await databasePool.query(
            "SELECT * FROM network_devices WHERE name LIKE '%DEPAN BALAI DESA BESOLE%'"
        );
        const odc = (odcs as any[])[0];

        if (odc) {
            console.log('Target ODC found:', odc.name, odc.latitude, odc.longitude);

            const [overlapping] = await databasePool.query(
                "SELECT * FROM network_devices WHERE latitude = ? AND longitude = ? AND id != ?",
                [odc.latitude, odc.longitude, odc.id]
            );

            console.log('Overlapping devices:', JSON.stringify(overlapping, null, 2));
        } else {
            console.log('ODC not found in network_devices');
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkODC();
