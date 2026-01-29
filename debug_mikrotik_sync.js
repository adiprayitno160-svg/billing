
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });

        const script = `
require('dotenv').config();
const { getMikrotikConfig, findPppProfileIdByName } = require('./dist/services/pppoeService');
const { mikrotikPool } = require('./dist/services/MikroTikConnectionPool');

async function debugProfile() {
    const config = await getMikrotikConfig();
    if (!config) return console.log('No config');
    
    const profiles = await mikrotikPool.execute(config, '/ppp/profile/print', []);
    console.log('--- MIKROTIK PPPoE PROFILES ---');
    profiles.forEach(p => {
        console.log(\`Profile: \${p.name}\`);
        console.log(\`  - Parent Queue: \${p['parent-queue'] || 'none'}\`);
        console.log(\`  - Rate Limit: \${p['rate-limit'] || 'none'}\`);
    });

    const queues = await mikrotikPool.execute(config, '/queue/simple/print', []);
    console.log('\\n--- MIKROTIK SIMPLE QUEUES ---');
    queues.forEach(q => {
        console.log(\`Queue: \${q.name} | Target: \${q.target} | Parent: \${q.parent} | MaxLimit: \${q['max-limit']}\`);
    });
}

debugProfile();
`;
        await ssh.execCommand(\`node -e "\${script.replace(/"/g, '\\\\"')}"\`, { cwd: '/var/www/billing' }).then(res => {
            console.log(res.stdout);
            console.error(res.stderr);
        });

        ssh.dispose();
    } catch (e) { console.error(e); }
})();
