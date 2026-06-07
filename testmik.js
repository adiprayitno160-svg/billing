const mikrotik = require('./dist/services/mikrotikService');
const { getMikrotikConfig } = require('./dist/services/pppoeService');

async function main() {
    const cfg = await getMikrotikConfig();
    const active = await mikrotik.getPppoeActiveConnections(cfg);
    console.log("Active PPPoE Count:", active.length);
    console.log("Active Customers (sample):", active.slice(0, 10).map(c => c.name));
    process.exit(0);
}
main();
