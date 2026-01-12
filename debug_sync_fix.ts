
import { databasePool } from './src/db/pool';
import { getMikrotikConfig, getQueueTrees } from './src/services/mikrotikService';
import { syncClientQueues } from './src/services/staticIpPackageService';

async function debugSync() {
    console.log('Starting Debug...');

    // 1. Get Customer
    const [custRows] = await databasePool.execute('SELECT * FROM customers WHERE name LIKE "%Ponakanae kevin%"');
    const customer = (custRows as any)[0];
    if (!customer) {
        console.error('Customer not found!');
        process.exit(1);
    }
    console.log('Customer Found:', customer.id, customer.name, customer.ip_address);

    // 2. Get Package "PAKET 110"
    const [pkgRows] = await databasePool.execute('SELECT * FROM static_ip_packages WHERE name LIKE "%PAKET 110%"');
    const pkg = (pkgRows as any)[0];
    if (!pkg) {
        console.error('Package not found!');
        process.exit(1);
    }
    console.log('Target Package Found:', pkg.id, pkg.name, 'Limit:', pkg.max_limit_download);

    // 3. Check MikroTik Queues
    console.log('Checking MikroTik Queues...');
    const config = await getMikrotikConfig();
    if (!config) {
        console.error('MikroTik Config not found');
        process.exit(1);
    }

    // Manual check logic simulation
    const allQueues = await getQueueTrees(config);
    const clientName = customer.name;
    const cleanIp = '192.168.5.2'; // Hardcoded from user request

    // Fuzzy Parent Search
    const suffix = 'DOWNLOAD';
    const strictName = `${pkg.name}_${suffix}`;
    console.log(`Looking for Parent Strict: '${strictName}'`);

    const candidate = allQueues.find(q =>
        q.name.toLowerCase().includes(pkg.name.toLowerCase()) &&
        q.name.includes(suffix)
    );
    console.log(`Fuzzy Parent Candidate:`, candidate ? candidate.name : 'NONE');

    // Queue Search
    console.log(`Looking for Client Queue: '${clientName}'`);
    const qmatch = allQueues.find(q => q.name === clientName);
    console.log('Exact Name Match:', qmatch ? `FOUND ID: ${qmatch['.id']} Parent: ${qmatch.parent}` : 'NOT FOUND');

    const ipMatch = allQueues.find(q => q['packet-mark'] && q['packet-mark'].includes(cleanIp));
    console.log('IP Match:', ipMatch ? `FOUND ID: ${ipMatch['.id']} Name: ${ipMatch.name}` : 'NOT FOUND');

    // 4. Run Sync
    console.log('>>> RUNNING SYNC <<<');
    try {
        await syncClientQueues(customer.id, pkg.id, cleanIp, customer.name);
        console.log('Sync executed.');
    } catch (e) {
        console.error('Sync Error:', e);
    }

    process.exit(0);
}

debugSync();
