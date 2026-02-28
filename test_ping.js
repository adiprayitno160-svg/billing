// Test script to run PingService monitorAllStaticIPs
(async () => {
    try {
        const { default: pingService } = await import('./dist/services/pingService');
        console.log('Running PingService.monitorAllStaticIPs...');
        await pingService.monitorAllStaticIPs();
        console.log('PingService completed');
    } catch (err) {
        console.error('Error running PingService:', err);
    }
})();
