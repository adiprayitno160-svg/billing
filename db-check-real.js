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

    // 1. Invoices of Kelvin Niko (customer_id = 39)
    console.log('=== Step 1: Invoices of Kelvin Niko (customer_id = 39) ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT id, invoice_number, period, total_amount, status, created_at, paid_at FROM invoices WHERE customer_id = 39 ORDER BY created_at DESC;" billing');

    // 2. Notifications of Kelvin Niko (customer_id = 39)
    console.log('\n=== Step 2: Notifications of Kelvin Niko (customer_id = 39) ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT id, invoice_id, payment_id, notification_type, template_code, status, error_message, attachment_path, created_at FROM unified_notifications_queue WHERE customer_id = 39 ORDER BY created_at DESC LIMIT 15;" billing');

    // 3. Let\'s see the last 15 entries in the queue overall to understand what was sent
    console.log('\n=== Step 3: Last 15 Entries in Unified Queue ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT n.id, n.customer_id, c.name, n.invoice_id, n.notification_type, n.template_code, n.status, n.error_message, n.attachment_path, n.created_at FROM unified_notifications_queue n JOIN customers c ON n.customer_id = c.id ORDER BY n.created_at DESC LIMIT 15;" billing');

  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

check();
