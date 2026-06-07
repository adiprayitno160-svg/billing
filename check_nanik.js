const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const remoteScript = `
const mysql = require('/var/www/billing/node_modules/mysql2/promise');

async function main() {
  let c;
  try {
    c = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'BillingRoot123',
      database: 'billing',
      connectTimeout: 5000
    });

    // Cari customer Nanik
    const [customers] = await c.query("SELECT id, name, is_isolated, isolation_enabled, status FROM customers WHERE name LIKE '%nanik%' OR name LIKE '%Nanik%' LIMIT 10");
    console.log('CUSTOMERS:', JSON.stringify(customers, null, 2));

    if (customers.length > 0) {
      for (const customer of customers) {
        console.log(\`=== INVOICES FOR \${customer.name} (ID: \${customer.id}) ===\`);
        const [invoices] = await c.query(
          "SELECT id, invoice_number, period, due_date, total_amount, paid_amount, remaining_amount, status FROM invoices WHERE customer_id = ? ORDER BY period DESC",
          [customer.id]
        );
        console.log(JSON.stringify(invoices, null, 2));

        console.log(\`=== PAYMENTS FOR \${customer.name} (ID: \${customer.id}) ===\`);
        const [payments] = await c.query(
          "SELECT p.id, p.amount, p.payment_method, p.payment_date, p.notes, i.invoice_number FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.customer_id = ? ORDER BY p.created_at DESC LIMIT 10",
          [customer.id]
        );
        console.log(JSON.stringify(payments, null, 2));
      }
    }

  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    if (c) await c.end();
    process.exit(0);
  }
}

main();
`;

async function run() {
  const base64Str = Buffer.from(remoteScript).toString('base64');
  await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
  await ssh.execCommand(`echo "${base64Str}" | base64 -d > /tmp/qnanik.js`);
  const result = await ssh.execCommand('node /tmp/qnanik.js', { cwd: '/var/www/billing' });
  console.log('STDOUT:\n', result.stdout);
  await ssh.execCommand('rm -f /tmp/qnanik.js');
  ssh.dispose();
}

run().catch(console.error);
