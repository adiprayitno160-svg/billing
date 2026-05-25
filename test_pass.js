const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({host: '192.168.239.154', username: 'adi', password: 'adi'}).then(async () => {
  const r1 = await ssh.execCommand('mysql -u root -e "SELECT 1"', {cwd: '/var/www/billing'});
  console.log('Empty password:', r1.stdout || r1.stderr);
  
  const r2 = await ssh.execCommand('mysql -u root -padi -e "SELECT 1"', {cwd: '/var/www/billing'});
  console.log('Password adi:', r2.stdout || r2.stderr);

  const r3 = await ssh.execCommand('mysql -u root -pBillingRoot123 -e "SELECT 1"', {cwd: '/var/www/billing'});
  console.log('Password BillingRoot123:', r3.stdout || r3.stderr);
  
  process.exit(0);
}).catch(console.error);
