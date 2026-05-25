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

    console.log('=== Describe unified_notifications_queue ===');
    await run('mysql -u root -pBillingRoot123 -e "DESCRIBE unified_notifications_queue;" billing');

    console.log('\n=== Describe invoices ===');
    await run('mysql -u root -pBillingRoot123 -e "DESCRIBE invoices;" billing');

  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

check();
