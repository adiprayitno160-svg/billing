import { NetworkMonitoringService } from './src/services/monitoring/NetworkMonitoringService';

async function sync() {
    try {
        await NetworkMonitoringService.initialize();
        console.log('🔄 Creating links...');
        const created = await NetworkMonitoringService.autoCreateLinks();
        console.log(`✅ Created ${created} links`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

sync();
