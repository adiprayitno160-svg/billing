const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run(cmd, cwd = '/var/www/billing') {
  console.log(`\n>>> ${cmd}`);
  const r = await ssh.execCommand(cmd, { cwd });
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.log('STDERR:', r.stderr);
  return r;
}

async function fix() {
  try {
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected!\n');

    // 1. Delete old LID for Mbah Tini (customer_id = 129)
    console.log('=== Step 1: Deleting old LID for customer 129 ===');
    await run('mysql -u root -pBillingRoot123 -e "DELETE FROM customer_wa_lids WHERE customer_id = 129;" billing');

    // 2. Double check customer details
    console.log('=== Step 2: Verification of customer table ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT id, name, phone FROM customers WHERE id = 129;" billing');

    // 3. Queue a new invoice_created notification for Mbah Tini\'s last invoice (INV/2026/05/0027 - ID 1110)
    console.log('=== Step 3: Triggering new notification via script ===');
    const jsCode = `
const { UnifiedNotificationService } = require('./dist/services/notification/UnifiedNotificationService');

async function test() {
  try {
    console.log('Dispatching notifyInvoiceCreated for invoice 1110...');
    const ids = await UnifiedNotificationService.notifyInvoiceCreated(1110, true);
    console.log('Done! Queued notification IDs:', ids);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
`;
    // Write this script in /var/www/billing and run it!
    await run(`echo '${jsCode.replace(/'/g, "'\\''")}' > /var/www/billing/trigger_mbah_tini.js`);
    await run('node trigger_mbah_tini.js');
    await run('rm trigger_mbah_tini.js');

    // 4. Check unified queue for customer 129
    console.log('=== Step 4: Verification of queue ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT id, status, error_message, created_at FROM unified_notifications_queue WHERE customer_id = 129 ORDER BY created_at DESC LIMIT 3;" billing');

  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

fix();
