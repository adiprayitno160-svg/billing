const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const remoteScript = `
const { getMikrotikConfig, getMikrotikConnection } = require('/var/www/billing/dist/services/mikrotikService');
const { databasePool } = require('/var/www/billing/dist/db/pool');

async function main() {
    let conn;
    try {
        const config = await getMikrotikConfig();
        if (!config) {
            console.log('No Mikrotik config');
            process.exit(1);
        }
        conn = await getMikrotikConnection(config);
        
        console.log('Querying secret for 042200424012@id.net...');
        const secretResult = await conn.write('/ppp/secret/print', ['?name=042200424012@id.net']);
        console.log('Secret Status:', JSON.stringify(secretResult, null, 2));

    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        if (conn) conn.close();
        await databasePool.end();
        setTimeout(() => process.exit(0), 1000);
    }
}
main();
`;

async function run() {
  const base64Str = Buffer.from(remoteScript).toString('base64');
  await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
  await ssh.execCommand(`echo "${base64Str}" | base64 -d > /tmp/qmik2.js`);
  const result = await ssh.execCommand('node /tmp/qmik2.js', { cwd: '/var/www/billing' });
  console.log('STDOUT:\n', result.stdout);
  if (result.stderr) console.error('STDERR:\n', result.stderr);
  await ssh.execCommand('rm -f /tmp/qmik2.js');
  ssh.dispose();
}

run().catch(console.error);
