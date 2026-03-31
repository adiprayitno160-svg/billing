const { databasePool } = require('./dist/db/pool');
async function check() {
  const [rows] = await databasePool.query("SELECT period, COUNT(*) as cnt, SUM(total_amount) as total, AVG(total_amount) as avg_amount, MIN(total_amount) as min_amt, MAX(total_amount) as max_amt FROM invoices WHERE period IN ('2026-02','2026-03') GROUP BY period ORDER BY period");
  console.log('=== INVOICE SUMMARY BY PERIOD ===');
  console.table(rows);
  
  const [feb] = await databasePool.query("SELECT i.id, i.invoice_number, i.period, i.total_amount, i.paid_amount, i.status, c.name FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE period = '2026-02' ORDER BY i.total_amount DESC LIMIT 20");
  console.log('=== FEB 2026 INVOICES (top 20) ===');
  console.table(feb);
  
  const [amt220] = await databasePool.query("SELECT i.id, i.invoice_number, i.period, i.total_amount, i.status, c.name FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.total_amount = 220000 AND period = '2026-03' LIMIT 15");
  console.log('=== MARCH INVOICES WITH 220000 ===');
  console.table(amt220);
  
  // Check how invoice items are structured for a 220k invoice
  const [sample] = await databasePool.query("SELECT ii.*, i.invoice_number, i.period FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE i.total_amount = 220000 AND i.period = '2026-03' LIMIT 10");
  console.log('=== ITEMS OF 220K MARCH INVOICES ===');
  console.table(sample);

  // Check subscription/package prices  
  const [pkgs] = await databasePool.query("SELECT id, name, price FROM pppoe_packages ORDER BY price");
  console.log('=== PPPOE PACKAGES ===');
  console.table(pkgs);

  const [spkgs] = await databasePool.query("SELECT id, name, price FROM static_ip_packages ORDER BY price");
  console.log('=== STATIC IP PACKAGES ===');
  console.table(spkgs);

  // Check carry_over_invoices
  const [carries] = await databasePool.query("SELECT target_period, COUNT(*) as cnt, SUM(carry_over_amount) as total FROM carry_over_invoices WHERE status = 'pending' GROUP BY target_period");
  console.log('=== PENDING CARRY OVERS ===');
  console.table(carries);

  process.exit(0);
}
check().catch(e => { console.error(e.message); process.exit(1); });
