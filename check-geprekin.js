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

    console.log('\n=== Step 2: Invoices for Geprekin (customer_id = 276) ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT id, invoice_number, total_amount, paid_amount, remaining_amount, status, period FROM invoices WHERE customer_id = 276 ORDER BY period DESC;" billing');

    console.log('\n=== Step 3: Debt Tracking entries for Geprekin ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT * FROM debt_tracking WHERE customer_id = 276;" billing');

  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

check();
