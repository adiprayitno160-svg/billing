import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const remoteScript = `
const mysql = require('/var/www/billing/node_modules/mysql2/promise');
const dotenv = require('/var/www/billing/node_modules/dotenv');
const fs = require('fs');

async function run() {
  const envConfig = dotenv.parse(fs.readFileSync('/var/www/billing/.env'));
  const conn = await mysql.createConnection({
    host: envConfig.DB_HOST,
    user: envConfig.DB_USER,
    password: envConfig.DB_PASSWORD,
    database: envConfig.DB_NAME,
    socketPath: '/run/mysqld/mysqld.sock'
  });

  try {
    await conn.beginTransaction();
    console.log('--- FINALIZING YUDI SANTOSO FEB FIX ---');

    const yudiId = 265;
    const invoiceId = 850;
    const packageId = 1; // PAKET 110K
    const profileId = 2; // 110k-test

    // 1. Fix Invoice 850 (Re-calculate balance)
    await conn.query("UPDATE invoices SET total_amount = 110000, remaining_amount = 110000, paid_amount = 0, status = 'sent' WHERE id = ?", [invoiceId]);
    console.log('✅ Updated Invoice 850 (Feb 2026) balance to 110,000');

    // 2. Clear invoice items and re-insert correct one
    await conn.query("DELETE FROM invoice_items WHERE invoice_id = ?", [invoiceId]);
    await conn.query("INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES (?, 'Tagihan Internet PAKET 110K - Feb 2026', 1, 110000, 110000)", [invoiceId]);
    console.log('✅ Re-created Invoice Items for ID 850');

    // 3. Update Customer Profile
    await conn.query("UPDATE customers SET pppoe_profile_id = ?, connection_type = 'pppoe' WHERE id = ?", [profileId, yudiId]);
    console.log('✅ Updated Customer Yudi Santoso Profile to 110k-test');

    // 4. Create/Update Subscription
    const [existingSub] = await conn.query("SELECT id FROM subscriptions WHERE customer_id = ?", [yudiId]);
    if (existingSub.length > 0) {
      await conn.query("UPDATE subscriptions SET package_id = ?, package_name = 'PAKET 110K', price = 110000, status = 'active' WHERE id = ?", [packageId, existingSub[0].id]);
      console.log('✅ Updated existing Subscription for Yudi Santoso');
    } else {
      await conn.query("INSERT INTO subscriptions (customer_id, package_id, package_name, price, status, billing_cycle_type, start_date) VALUES (?, ?, 'PAKET 110K', 110000, 'active', 'monthly', '2026-02-01')", [yudiId, packageId]);
      console.log('✅ Created new Subscription for Yudi Santoso');
    }

    // 5. Debt Tracking (Ensure no duplicate)
    await conn.query("DELETE FROM debt_tracking WHERE customer_id = ? AND period = '2026-02'", [yudiId]);
    await conn.query("INSERT INTO debt_tracking (customer_id, invoice_id, amount_due, amount_paid, remaining_amount, status, period) VALUES (?, ?, 110000, 0, 110000, 'unpaid', '2026-02')", [yudiId, invoiceId]);
    console.log('✅ Synchronized Debt Tracking for Feb 2026');

    await conn.commit();
    console.log('--- ALL FIXES APPLIED SUCCESSFULLY ---');
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('FAILED:', err.message);
  } finally {
    if (conn) await conn.end();
  }
}
run();
        `;
        await ssh.execCommand("cat << 'EOF' > /tmp/yudi_final_sync.js\n" + remoteScript + "\nEOF");
        const res = await ssh.execCommand('node /tmp/yudi_final_sync.js', { cwd: '/var/www/billing' });
        console.log(res.stdout || res.stderr);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
