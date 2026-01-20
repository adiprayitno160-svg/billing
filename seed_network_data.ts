import { databasePool } from './src/db/pool';

async function seed() {
    try {
        console.log('🌱 Seeding network data...');

        // 1. OLT
        console.log('Inserting OLT...');
        const [oltResult] = await databasePool.query<any>(
            'INSERT INTO ftth_olt (name, latitude, longitude, location) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=name',
            ['OLT Central Jakarta', -6.200000, 106.816666, 'Kuningan, Jakarta']
        );
        const oltId = oltResult.insertId || 1;

        // 2. ODC
        console.log('Inserting ODC...');
        const [odcResult] = await databasePool.query<any>(
            'INSERT INTO ftth_odc (name, olt_id, latitude, longitude, location, total_ports) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=name',
            ['ODC-KNG-01', oltId, -6.210000, 106.820000, 'Jl. Rasuna Said', 12]
        );
        const odcId = odcResult.insertId || 1;

        // 3. ODP
        console.log('Inserting ODP...');
        const [odpResult] = await databasePool.query<any>(
            'INSERT INTO ftth_odp (name, odc_id, latitude, longitude, location, total_ports, used_ports) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=name',
            ['ODP-KNG-01-01', odcId, -6.215000, 106.825000, 'Jl. Karet Belakang', 8, 1]
        );

        const odpId = odpResult.insertId || 1;

        // 4. Update Customer
        console.log('Updating Customer 86...');
        await databasePool.query(
            'UPDATE customers SET latitude = ?, longitude = ?, odc_id = ?, odp_id = ?, address = ? WHERE id = 86',
            [-6.216000, 106.826000, odcId, odpId, 'Rumah ddddd, Jakarta']
        );

        console.log('✅ Seeding complete!');

        // Trigger Sync
        console.log('🔄 Triggering Sync...');
        const { NetworkMonitoringService } = await import('./src/services/monitoring/NetworkMonitoringService');
        await NetworkMonitoringService.initialize();
        await NetworkMonitoringService.syncFTTHInfrastructure();
        await NetworkMonitoringService.syncCustomerDevices();

        // Sync Links
        // We need to sync links too. Let's see how links are synced.
        // In NetworkMonitoringService, there's likely a syncLinks method.
    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        process.exit();
    }
}

seed();
