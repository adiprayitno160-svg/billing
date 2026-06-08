const { databasePool } = require('./dist/db/pool');
const { NetworkMonitoringService } = require('./dist/services/monitoring/NetworkMonitoringService');

async function test() {
    try {
        const customers = await NetworkMonitoringService.getTroubleCustomers(false);
        console.log('Total trouble customers:', customers.length);
        if (customers.length > 0) {
            console.log(customers.slice(0, 2));
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
test();
