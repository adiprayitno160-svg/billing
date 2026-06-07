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
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    console.log('Connected!\n');

    console.log('=== Customer Eva ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT id, name, pppoe_username, is_isolated, isolation_enabled, status FROM customers WHERE name LIKE \'%eva%\';" billing');

    console.log('\n=== Isolation logs for Eva ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT * FROM isolation_logs WHERE customer_id = (SELECT id FROM customers WHERE name LIKE \'%eva resiana%\' LIMIT 1) ORDER BY created_at DESC LIMIT 5;" billing');

  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

check();
