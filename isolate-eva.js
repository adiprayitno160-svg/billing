const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const remoteScript = `
const { databasePool } = require('/var/www/billing/dist/db/pool');
const IsolationService = require('/var/www/billing/dist/services/billing/isolationService').default;

async function main() {
    try {
        console.log('Manually isolating Eva (ID: 89)...');
        // Manual isolate: action='isolate', reason='Manual re-disable by Admin', performedBy='admin'
        const result = await IsolationService.manualIsolate(89, 'isolate', 'Dinonaktifkan kembali oleh admin (Manual)', 'admin');
        console.log('Isolation Result:', result);
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        await databasePool.end();
        setTimeout(() => process.exit(0), 1000);
    }
}
main();
`;

async function run() {
  const base64Str = Buffer.from(remoteScript).toString('base64');
  await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
  await ssh.execCommand(`echo "${base64Str}" | base64 -d > /tmp/qmik3.js`);
  const result = await ssh.execCommand('node /tmp/qmik3.js', { cwd: '/var/www/billing' });
  console.log('STDOUT:\n', result.stdout);
  if (result.stderr) console.error('STDERR:\n', result.stderr);
  await ssh.execCommand('rm -f /tmp/qmik3.js');
  ssh.dispose();
}

run().catch(console.error);
