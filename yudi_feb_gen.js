const { NodeSSH } = require('node-ssh');

async function processYudiAndCleanup() {
    const ssh = new NodeSSH();
    try {
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi'
        });
        console.log('Connected to live server');

        // Create a proper JS file on the remote server to execute
        const remoteScript = `
const { databasePool } = require('./dist/db/pool');
const { InvoiceService } = require('./dist/services/billing/invoiceService');

async function run() {
  const conn = await databasePool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Find Yudi Santoso
    const [yudi] = await conn.query("SELECT id, name FROM customers WHERE name LIKE '%Yudi Santoso%' LIMIT 1");
    if (yudi.length === 0) {
      console.log('ERROR: Yudi Santoso not found');
    } else {
      const yudiId = yudi[0].id;
      console.log('Found Yudi Santoso ID:', yudiId);

      // Check if Feb 2026 invoice exists for Yudi
      const [existing] = await conn.query("SELECT id FROM invoices WHERE customer_id = ? AND period = '2026-02'", [yudiId]);
      if (existing.length > 0) {
        console.log('Yudi Santoso Feb 2026 invoice already exists ID:', existing[0].id);
      } else {
        console.log('Generating Feb 2026 invoice for Yudi Santoso...');
        // We use InvoiceService if available, otherwise manual insert
        try {
           const invoiceService = new InvoiceService();
           await invoiceService.generateInvoice(yudiId, '2026-02');
           console.log('SUCCESS: Generated invoice for Yudi Santoso via InvoiceService');
        } catch (err) {
           console.log('InvoiceService failed, attempting manual insertion...');
           // Manual fallback if service fails
           const [sub] = await conn.query("SELECT s.package_name, s.price FROM subscriptions s WHERE s.customer_id = ? AND s.status = 'active' LIMIT 1", [yudiId]);
           const pkgName = sub.length > 0 ? sub[0].package_name : 'Paket Internet';
           const price = sub.length > 0 ? sub[0].price : 110000;
           
           const invNo = 'INV/2026/02/' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
           const [inv] = await conn.query("INSERT INTO invoices (invoice_number, customer_id, period, total_amount, status, due_date) VALUES (?, ?, '2026-02', ?, 'sent', '2026-02-10')", 
             [invNo, yudiId, price]);
           const invId = inv.insertId;
           await conn.query("INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES (?, ?, 1, ?, ?)",
             [invId, 'Tagihan Internet ' + pkgName + ' - Feb 2026', price, price]);
           console.log('SUCCESS: Manually generated invoice ID:', invId);
        }
      }
    }

    // 2. Cleanup other Feb invoices (except Yudi Santoso)
    const [toDelete] = await conn.query("SELECT i.id FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.period = '2026-02' AND i.status != 'paid' AND c.name NOT LIKE '%Yudi Santoso%'");
    console.log('Found ' + toDelete.length + ' unpaid Feb invoices to cleanup.');
    
    if (toDelete.length > 0) {
      const ids = toDelete.map(inv => inv.id);
      await conn.query('DELETE FROM invoice_items WHERE invoice_id IN (?)', [ids]);
      await conn.query('DELETE FROM debt_tracking WHERE invoice_id IN (?)', [ids]);
      await conn.query('DELETE FROM carry_over_invoices WHERE invoice_id IN (?)', [ids]);
      await conn.query('DELETE FROM invoices WHERE id IN (?)', [ids]);
      console.log('Deleted ' + toDelete.length + ' invoices.');
    }

    // 3. Cleanup duplicate debt_tracking for WAWAN SAWO
    await conn.query('DELETE FROM debt_tracking WHERE id = 8 AND customer_id = 169');
    console.log('Cleaned duplicate debt_tracking for WAWAN SAWO');

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('FAILED:', err.message);
  } finally {
    conn.release();
  }
}
run();
`;
        
        await ssh.execCommand(`cat << 'EOF' > /tmp/yudi_cleanup.js\n${remoteScript}\nEOF`);
        const result = await ssh.execCommand('node /tmp/yudi_cleanup.js', { cwd: '/var/www/billing' });
        
        console.log(result.stdout);
        if (result.stderr) console.error('STDERR:', result.stderr);
        
        ssh.dispose();
    } catch(e) {
        console.error('Error:', e.message);
    }
}
processYudiAndCleanup();
