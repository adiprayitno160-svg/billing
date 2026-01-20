
import { NetworkMonitoringService } from '../services/monitoring/NetworkMonitoringService';

async function testTopologyFast() {
    try {
        console.log('Initializing service...');
        await NetworkMonitoringService.initialize();
        console.log('Calling getNetworkTopologyFast...');
        const result = await NetworkMonitoringService.getNetworkTopologyFast();
        console.log('Result devices count:', result.devices.length);
        console.log('Result links count:', result.links.length);
        console.log('Result stats:', JSON.stringify(result.statistics, null, 2));
    } catch (e) {
        console.error('ERROR in getNetworkTopologyFast:', e);
    } finally {
        process.exit();
    }
}

testTopologyFast();
