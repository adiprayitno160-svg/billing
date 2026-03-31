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
    console.log('--- STARTING YUDI FIX (Absolute DB) ---');

    // 1. Find Yudi Santoso
    const [yudi] = await conn.query("SELECT id, name FROM customers WHERE name LIKE '%Yudi Santoso%' LIMIT 1");
    if (yudi.length === 0) {
      console.log('ERROR: Yudi Santoso not found');
    } else {
      const yudiId = yudi[0].id;
      console.log('Found Yudi Santoso ID:', yudiId);

      const [existing] = await conn.query("SELECT id FROM invoices WHERE customer_id = ? AND period = '2026-02'", [yudiId]);
      if (existing.length > 0) {
        console.log('Yudi Santoso Feb 2026 invoice already exists ID:', existing[0].id);
      } else {
        console.log('Generating Feb 2026 invoice for Yudi Santoso (Manual)...');
        const [sub] = await conn.query("SELECT s.package_name, s.price FROM subscriptions s WHERE s.customer_id = ? AND s.status = 'active' LIMIT 1", [yudiId]);
        const pkgName = sub.length > 0 ? sub[0].package_name : 'Paket Internet';
        const price = sub.length > 0 ? sub[0].price : 110000;
        
        const invNo = 'INV/2026/02/' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const [inv] = await conn.query("INSERT INTO invoices (invoice_number, customer_id, period, total_amount, remaining_amount, status, due_date, created_at) VALUES (?, ?, '2026-02', ?, ?, 'sent', '2026-02-10', '2026-02-01 00:00:00')", 
          [invNo, yudiId, price, price]);
        const invId = inv.insertId;
        await conn.query("INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES (?, ?, 1, ?, ?)",
          [invId, 'Tagihan Internet ' + pkgName + ' - Feb 2026', price, price]);
        console.log('SUCCESS: Generated invoice ID:', invId);
      }
    }

    // 2. Cleanup other Feb invoices
    const [toDelete] = await conn.query("SELECT i.id FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.period = '2026-02' AND i.status != 'paid' AND c.name NOT LIKE '%Yudi Santoso%'");
    console.log('Cleanup: Found ' + toDelete.length + ' unpaid Feb invoices.');
    if (toDelete.length > 0) {
      const ids = toDelete.map(inv => inv.id);
      await conn.query('DELETE FROM invoice_items WHERE invoice_id IN (?)', [ids]);
      await conn.query('DELETE FROM debt_tracking WHERE invoice_id IN (?)', [ids]);
      await conn.query('DELETE FROM invoices WHERE id IN (?)', [ids]);
      console.log('Deleted ' + toDelete.length + ' invoices.');
    }

    await conn.commit();
    console.log('--- YUDI FIX COMPLETED ---');
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('FAILED:', err.message);
  } finally {
    if (conn) await conn.end();
  }
}
run();
        `;
        await ssh.execCommand("cat << 'EOF' > /tmp/yudi_fix_direct.js\n" + remoteScript + "\nEOF");
        const res = await ssh.execCommand('node /tmp/yudi_fix_direct.js', { cwd: '/var/www/billing' });
        console.log(res.stdout || res.stderr);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
