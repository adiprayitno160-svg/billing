const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
  const result = await ssh.execCommand('mysql -u root -pBillingRoot123 -e "SELECT * FROM mikrotik_routers;" billing');
  console.log('STDOUT:\n', result.stdout);
  if (result.stderr) console.error('STDERR:\n', result.stderr);
  ssh.dispose();
}

run().catch(console.error);
