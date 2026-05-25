const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run(cmd, cwd = '/var/www/billing') {
  console.log(`\n>>> ${cmd}`);
  const r = await ssh.execCommand(cmd, { cwd });
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.log('STDERR:', r.stderr);
  return r;
}

async function main() {
  try {
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected!\n');

    // Step 1: Sync existing partial/unpaid/overdue invoices into debt_tracking
    console.log('=== Step 1: Sync existing partial invoices into debt_tracking ===');
    await run(`mysql -u root -pBillingRoot123 -e "
      INSERT INTO debt_tracking (customer_id, invoice_id, debt_amount, debt_reason, status, created_at, updated_at)
      SELECT customer_id, id, remaining_amount, 'Pembayaran parsial terdahulu', 'active', NOW(), NOW()
      FROM invoices
      WHERE status IN ('partial', 'unpaid', 'overdue', 'hutang') 
        AND remaining_amount > 0 
        AND id NOT IN (SELECT invoice_id FROM debt_tracking WHERE status = 'active')
    " billing`);

    // Step 2: Verify debt_tracking now has Geprekin
    console.log('\n=== Step 2: Verify Geprekin (276) in debt_tracking ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT dt.*, c.name as customer_name FROM debt_tracking dt JOIN customers c ON dt.customer_id = c.id WHERE dt.customer_id = 276;" billing');

    // Step 3: Show all active debts
    console.log('\n=== Step 3: All active debts ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT dt.id, c.name, i.invoice_number, dt.debt_amount, dt.status FROM debt_tracking dt JOIN customers c ON dt.customer_id = c.id JOIN invoices i ON dt.invoice_id = i.id WHERE dt.status = \'active\' ORDER BY dt.debt_amount DESC LIMIT 20;" billing');

    console.log('\n✅ Migration complete!');

  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

main();
