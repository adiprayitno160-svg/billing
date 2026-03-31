const { databasePool } = require('./dist/db/pool');

async function run() {
  const conn = await databasePool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Verify Yudi Santoso Feb 2026 invoice
    const [yudi] = await conn.query("SELECT i.id, i.invoice_number, c.name FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE c.name LIKE '%Yudi Santoso%' AND i.period = '2026-02'");
    if (yudi.length > 0) {
      console.log('SUCCESS: Yudi Santoso Feb 2026 invoice found:', yudi[0].invoice_number);
    } else {
      console.log('WARNING: Yudi Santoso Feb 2026 invoice missing, re-generating...');
      const [yudiCust] = await conn.query("SELECT id FROM customers WHERE name LIKE '%Yudi Santoso%' LIMIT 1");
      if (yudiCust.length > 0) {
        const yudiId = yudiCust[0].id;
        const [sub] = await conn.query("SELECT package_name, price FROM subscriptions WHERE customer_id = ? AND status = 'active' LIMIT 1", [yudiId]);
        const price = sub.length > 0 ? sub[0].price : 110000;
        const invNo = 'INV/2026/02/' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const [inv] = await conn.query("INSERT INTO invoices (invoice_number, customer_id, period, total_amount, status, due_date) VALUES (?, ?, '2026-02', ?, 'sent', '2026-02-10')", [invNo, yudiId, price]);
        await conn.query("INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES (?, ?, 1, ?, ?)", [inv.insertId, 'Tagihan Internet - Feb 2026', price, price]);
        console.log('RE-GENERATED Yudi invoice ID:', inv.insertId);
      }
    }

    // 2. Cleanup other Feb invoices (except Yudi Santoso)
    const [toDelete] = await conn.query("SELECT i.id, c.name FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.period = '2026-02' AND i.status != 'paid' AND c.name NOT LIKE '%Yudi Santoso%'");
    console.log('Found ' + toDelete.length + ' unpaid Feb invoices for cleanup.');
    
    if (toDelete.length > 0) {
      const ids = toDelete.map(inv => inv.id);
      await conn.query('DELETE FROM invoice_items WHERE invoice_id IN (?)', [ids]);
      await conn.query('DELETE FROM debt_tracking WHERE invoice_id IN (?)', [ids]);
      // Note: carry_over_invoices DOES NOT HAVE invoice_id, it tracks it through period/customer.
      // So we skip that part to avoid error.
      await conn.query('DELETE FROM invoices WHERE id IN (?)', [ids]);
      console.log('Cleanup successful for ' + toDelete.length + ' invoices.');
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
    process.exit(0);
  }
}
run().catch(err => { console.error(err); process.exit(1); });
