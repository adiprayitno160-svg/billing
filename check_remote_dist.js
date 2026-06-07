const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
  const result = await ssh.execCommand('grep "removeActivePppConnection" /var/www/billing/dist/controllers/customerController.js');
  console.log(result.stdout);
  ssh.dispose();
}

run().catch(console.error);
