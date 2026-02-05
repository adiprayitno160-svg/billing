const { mikrotikPool } = require('./src/services/MikroTikConnectionPool');
const { getMikrotikConfig } = require('./src/services/staticIpClientService');

async function checkMikrotik() {
    try {
        const config = await getMikrotikConfig(2);
        console.log('--- IP ADDRESSES ---');
        const addresses = await mikrotikPool.execute(config, '/ip/address/print', []);
        console.log(JSON.stringify(addresses, null, 2));

        console.log('\n--- SIMPLE QUEUES FOR ADI ---');
        const queues = await mikrotikPool.execute(config, '/queue/simple/print', ['?target=192.168.238.38/32']);
        console.log(JSON.stringify(queues, null, 2));

        console.log('\n--- ADDRESS LISTS ---');
        const lists = await mikrotikPool.execute(config, '/ip/firewall/address-list/print', []);
        console.log(JSON.stringify(lists, null, 2));

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        process.exit(0);
    }
}

checkMikrotik();
