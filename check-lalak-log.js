const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
  const result = await ssh.execCommand('mysql -u root -pBillingRoot123 -e "SELECT * FROM isolation_logs WHERE customer_id = (SELECT id FROM customers WHERE name LIKE \'%lalak%\' LIMIT 1) ORDER BY created_at DESC LIMIT 5;" billing');
  console.log(result.stdout);
  ssh.dispose();
}

run().catch(console.error);
