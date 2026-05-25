const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({host: '192.168.239.154', username: 'adi', password: 'adi'}).then(async () => {
  await ssh.execCommand("sed -i 's/DB_PASSWORD=adi/DB_PASSWORD=BillingRoot123/g' .env", {cwd: '/var/www/billing'});
  const r = await ssh.execCommand("pm2 restart billing-app", {cwd: '/var/www/billing'});
  console.log(r.stdout);
  console.log('Fixed DB Password');
  process.exit(0);
}).catch(console.error);
