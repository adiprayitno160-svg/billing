const { Client } = require('ssh2'); 
const fs = require('fs');

const conn = new Client(); 

const migrationCode = `
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/billing/.env' });

async function migrate() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: process.env.DB_PASSWORD || 'BillingRoot123',
      database: 'billing'
    });

    console.log("=== Starting Migration ===");
    
    // Find all partial invoices
    const [partialInvoices] = await conn.query("SELECT id, customer_id, remaining_amount FROM invoices WHERE status = 'partial'");
    console.log("Found " + partialInvoices.length + " partial invoices.");

    for (const inv of partialInvoices) {
      if (inv.remaining_amount > 0) {
        // Check if debt tracking exists
        const [existing] = await conn.query('SELECT id FROM debt_tracking WHERE invoice_id = ?', [inv.id]);
        if (existing.length === 0) {
          // Insert into debt tracking
          await conn.query(
            "INSERT INTO debt_tracking (customer_id, invoice_id, debt_amount, debt_reason, status, created_at, updated_at) VALUES (?, ?, ?, 'Sisa tagihan dari pembayaran sebagian (Migrasi)', 'active', NOW(), NOW())",
            [inv.customer_id, inv.id, inv.remaining_amount]
          );
          console.log("Inserted debt tracking for invoice " + inv.id);
        } else {
            // Update debt tracking
            await conn.query(
              'UPDATE debt_tracking SET debt_amount = ?, status = "active", updated_at = NOW() WHERE id = ?',
              [inv.remaining_amount, existing[0].id]
            );
            console.log("Updated debt tracking for invoice " + inv.id);
        }
      }
    }

    // Update all partial to hutang
    if (partialInvoices.length > 0) {
        const [result] = await conn.query("UPDATE invoices SET status = 'hutang' WHERE status = 'partial'");
        console.log("Updated " + result.affectedRows + " invoices to hutang.");
    }

    console.log("=== Migration Complete ===");
    conn.end();
  } catch (err) {
    console.error(err);
  }
}
migrate();
`;

conn.on('ready', () => { 
  console.log('SSH Ready');
  const sftp = conn.sftp((err, sftp) => {
    if (err) throw err;
    const writeStream = sftp.createWriteStream('/var/www/billing/run_migrate.js');
    writeStream.on('close', () => {
      conn.exec('cd /var/www/billing && node run_migrate.js', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
              .on('data', d => process.stdout.write(d))
              .stderr.on('data', d => process.stderr.write(d));
      });
    });
    writeStream.write(migrationCode);
    writeStream.end();
  });
}).connect({host: '192.168.239.154', port: 22, username: 'adi', password: 'adi'});
