
import { databasePool } from '../db/pool';

async function checkCounts() {
    try {
        console.log('--- Table Row Counts ---');

        const tables = [
            'customers',
            'ftth_olt',
            'ftth_odc',
            'ftth_odp',
            'network_devices',
            'network_links'
        ];

        for (const table of tables) {
            try {
                const [rows]: any = await databasePool.query(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`${table}: ${rows[0].count}`);
            } catch (e: any) {
                console.log(`${table}: Table might not exist or error: ${e.message}`);
            }
        }

        console.log('--- Customers with Coordinates ---');
        const [custCoords]: any = await databasePool.query(`SELECT COUNT(*) as count FROM customers WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != '' AND longitude != ''`);
        console.log(`Customers with coords: ${custCoords[0].count}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

checkCounts();
