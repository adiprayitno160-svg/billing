const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/billing/.env' });

async function migrate() {
  try {
    const conn = await mysql.createConnection({
      host: '192.168.239.154',
      user: 'adi',
      password: 'adi',
      database: 'billing'
    });

    console.log("=== Starting Migration ===");
    
    // Find all partial invoices
    const [partialInvoices] = await conn.query(`SELECT id, customer_id, remaining_amount FROM invoices WHERE status = 'partial'`);
    console.log(`Found ${partialInvoices.length} partial invoices.`);

    for (const inv of partialInvoices) {
      if (inv.remaining_amount > 0) {
        // Check if debt tracking exists
        const [existing] = await conn.query('SELECT id FROM debt_tracking WHERE invoice_id = ?', [inv.id]);
        if (existing.length === 0) {
          // Insert into debt tracking
          await conn.query(
            `INSERT INTO debt_tracking (customer_id, invoice_id, debt_amount, debt_reason, status, created_at, updated_at) 
             VALUES (?, ?, ?, 'Sisa tagihan dari pembayaran sebagian (Migrasi)', 'active', NOW(), NOW())`,
            [inv.customer_id, inv.id, inv.remaining_amount]
          );
          console.log(`Inserted debt tracking for invoice ${inv.id}`);
        } else {
            // Update debt tracking
            await conn.query(
              'UPDATE debt_tracking SET debt_amount = ?, status = "active", updated_at = NOW() WHERE id = ?',
              [inv.remaining_amount, existing[0].id]
            );
            console.log(`Updated debt tracking for invoice ${inv.id}`);
        }
      }
    }

    // Update all partial to hutang
    if (partialInvoices.length > 0) {
        const [result] = await conn.query(`UPDATE invoices SET status = 'hutang' WHERE status = 'partial'`);
        console.log(`Updated ${result.affectedRows} invoices to hutang.`);
    }

    console.log("=== Migration Complete ===");
    conn.end();
  } catch (err) {
    console.error(err);
  }
}
migrate();
