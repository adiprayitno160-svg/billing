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

    console.log('=== CHECK LALAK CUSTOMER STATUS ===');
    const [cust] = await c.query("SELECT id, name, status FROM customers WHERE id = 90");
    console.log(JSON.stringify(cust, null, 2));

    console.log('\\n=== CHECK CASHIER PAYMENTS QUERY ===');
    const [cashierRes] = await c.query(\`
      SELECT c.id, c.name, c.status
      FROM customers c
      WHERE c.status = 'active' AND (SELECT COUNT(*) FROM invoices 
             WHERE customer_id = c.id 
             AND status IN ('sent', 'overdue')) > 0
    \`);
    const lalakInCashier = cashierRes.find(x => x.id === 90);
    console.log('Is Lalak in Cashier List?:', !!lalakInCashier);

    console.log('\\n=== CHECK CASHIER SEARCH QUERY (q=lalak) ===');
    const q = 'lalak';
    const [searchRes] = await c.query(\`
      SELECT c.id, c.name, c.status
      FROM customers c
      WHERE c.status = 'active' AND (c.customer_code LIKE ? 
         OR c.name LIKE ? 
         OR c.phone LIKE ?
         OR c.pppoe_username LIKE ?)
         AND (SELECT COUNT(*) FROM invoices 
              WHERE customer_id = c.id 
              AND status IN ('sent', 'overdue')) > 0
    \`, ['%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%']);
    console.log('Search Results:', JSON.stringify(searchRes, null, 2));

  } catch (e) {
    console.error('ERR:', e.stack || e.message);
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
  await ssh.execCommand(`echo "${base64Str}" | base64 -d > /tmp/test_lalak_hidden.js`);
  const result = await ssh.execCommand('node /tmp/test_lalak_hidden.js', { cwd: '/var/www/billing' });
  console.log('STDOUT:\n', result.stdout);
  if (result.stderr) console.error('STDERR:\n', result.stderr);
  await ssh.execCommand('rm -f /tmp/test_lalak_hidden.js');
  ssh.dispose();
}

run().catch(console.error);
