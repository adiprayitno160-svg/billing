const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run(cmd, cwd = '/var/www/billing') {
  console.log(`\n>>> ${cmd}`);
  const r = await ssh.execCommand(cmd, { cwd });
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.log('STDERR:', r.stderr);
  return r;
}

async function check() {
  try {
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected!\n');

    console.log('=== Subscription for Lalak ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT * FROM subscriptions WHERE customer_id = 90;" billing');




    console.log('\n=== Isolation logs for Lalak ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT * FROM isolation_logs WHERE customer_id = 90;" billing');


  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

check();
