
import NetworkMonitoringService from './src/services/monitoring/NetworkMonitoringService';

async function triggerSync() {
    try {
        console.log('🔄 Triggering full sync...');

        console.log('--- Syncing FTTH ---');
        await NetworkMonitoringService.syncFTTHInfrastructure();

        console.log('--- Syncing Customers ---');
        await NetworkMonitoringService.syncCustomerDevices();

        console.log('--- Syncing Links ---');
        await NetworkMonitoringService.autoCreateLinks();

        console.log('✅ Sync completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    }
}

triggerSync();
