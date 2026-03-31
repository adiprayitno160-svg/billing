const { NodeSSH } = require('node-ssh');

async function cleanupInvoices() {
    const ssh = new NodeSSH();
    try {
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi'
        });
        console.log('Connected to live server');

        const script = `
cd /var/www/billing && node -e "
const { databasePool } = require('./dist/db/pool');
async function run() {
  const conn = await databasePool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Identify invoices to delete (Feb 2026, status not paid, except Yudi Santoso)
    const [toDelete] = await conn.query(\\\"
      SELECT i.id, i.invoice_number, c.name 
      FROM invoices i 
      JOIN customers c ON i.customer_id = c.id 
      WHERE i.period = '2026-02' 
      AND i.status != 'paid' 
      AND c.name NOT LIKE '%Yudi Santoso%'
    \\\");

    console.log('Found ' + toDelete.length + ' invoices to cleanup.');
    
    if (toDelete.length > 0) {
      const ids = toDelete.map(inv => inv.id);
      
      // Cleanup related data first to avoid foreign key constraints
      // Delete invoice items
      await conn.query('DELETE FROM invoice_items WHERE invoice_id IN (?)', [ids]);
      console.log('Cleaned invoice_items');

      // Cleanup debt_tracking if any points to these invoices
      await conn.query('DELETE FROM debt_tracking WHERE invoice_id IN (?)', [ids]);
      console.log('Cleaned debt_tracking associated with these invoices');

      // Cleanup carry_over_invoices if any
      await conn.query('DELETE FROM carry_over_invoices WHERE invoice_id IN (?)', [ids]);
      console.log('Cleaned carry_over_invoices associated with these invoices');

      // Delete the invoices
      await conn.query('DELETE FROM invoices WHERE id IN (?)', [ids]);
      console.log('Deleted ' + toDelete.length + ' invoices from February 2026.');
    }

    // 2. Cleanup duplicate debt_tracking for WAWAN SAWO (Keep ID 7, remove ID 8)
    const [wawanDup] = await conn.query('SELECT * FROM debt_tracking WHERE id = 8 AND customer_id = 169');
    if (wawanDup.length > 0) {
       await conn.query('DELETE FROM debt_tracking WHERE id = 8');
       console.log('Cleaned duplicate debt_tracking ID 8 for WAWAN SAWO');
    }

    await conn.commit();
    console.log('CLEANUP SUCCESSFUL');
    
    // Print list of deleted names for confirmation
    console.log('DELETED_NAMES:', JSON.stringify(toDelete.map(i => i.name)));

  } catch (err) {
    await conn.rollback();
    console.error('CLEANUP FAILED:', err.message);
    process.exit(1);
  } finally {
    conn.release();
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
"`;
        
        const result = await ssh.execCommand(script);
        console.log(result.stdout);
        if (result.stderr) console.log('STDERR:', result.stderr);
        
        ssh.dispose();
    } catch(e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}
cleanupInvoices();
