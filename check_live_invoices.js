const { NodeSSH } = require('node-ssh');

async function checkLiveInvoices() {
    const ssh = new NodeSSH();
    try {
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi'
        });
        console.log('Connected');

        const script = `
cd /var/www/billing && node -e "
const { databasePool } = require('./dist/db/pool');
async function check() {
  // Check invoice_items columns
  const [cols] = await databasePool.query(\\\"DESCRIBE invoice_items\\\");
  console.log('INVOICE_ITEMS_COLS:', JSON.stringify(cols.map(c => c.Field)));

  // WAWAN SAWO 220k invoice items
  const [items] = await databasePool.query(\\\"SELECT ii.* FROM invoice_items ii WHERE ii.invoice_id = 848\\\");
  console.log('WAWAN_ITEMS:', JSON.stringify(items));

  // Feb unpaid count with status breakdown
  const [febStats] = await databasePool.query(\\\"SELECT status, COUNT(*) as cnt FROM invoices WHERE period = '2026-02' GROUP BY status\\\");
  console.log('FEB_STATUS:', JSON.stringify(febStats));

  // March unpaid count with status breakdown  
  const [marStats] = await databasePool.query(\\\"SELECT status, COUNT(*) as cnt, SUM(total_amount) as total FROM invoices WHERE period = '2026-03' GROUP BY status\\\");
  console.log('MAR_STATUS:', JSON.stringify(marStats));
  
  // Check who has both Feb AND Mar unpaid invoices (double billing issue)
  const [doubles] = await databasePool.query(\\\"SELECT c.name, c.customer_code, GROUP_CONCAT(CONCAT(i.period, ':', i.total_amount, ':', i.status) ORDER BY i.period) as invoices FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.status != 'paid' AND i.period IN ('2026-02','2026-03') GROUP BY c.id HAVING COUNT(DISTINCT i.period) = 2 ORDER BY c.name LIMIT 30\\\");
  console.log('DOUBLE_UNPAID:', JSON.stringify(doubles));

  // Check total unique customers with invoices vs total customers
  const [custCount] = await databasePool.query(\\\"SELECT (SELECT COUNT(*) FROM customers WHERE status != 'inactive') as active_custs, (SELECT COUNT(DISTINCT customer_id) FROM invoices WHERE period = '2026-03') as mar_invoiced\\\");
  console.log('CUST_VS_INVOICED:', JSON.stringify(custCount));

  // Check debt_tracking active
  const [debts] = await databasePool.query(\\\"SELECT dt.*, c.name, i.period, i.total_amount FROM debt_tracking dt JOIN customers c ON dt.customer_id = c.id JOIN invoices i ON dt.invoice_id = i.id WHERE dt.status = 'active' ORDER BY dt.debt_amount DESC LIMIT 15\\\");
  console.log('ACTIVE_DEBTS:', JSON.stringify(debts));

  process.exit(0);
}
check().catch(e => { console.error(e.message); process.exit(1); });
"`;
        
        const result = await ssh.execCommand(script);
        console.log(result.stdout);
        if (result.stderr) console.log('STDERR:', result.stderr);
        
        ssh.dispose();
        process.exit(0);
    } catch(e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}
checkLiveInvoices();
