const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/billing/.env' });

async function check() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: process.env.DB_PASSWORD,
      database: 'billing'
    });

    console.log("=== CUSTOMER DATA ===");
    const [customers] = await conn.query(`SELECT id, name, status, balance FROM customers WHERE name LIKE '%dipma%' OR name LIKE '%geprekin%'`);
    console.table(customers);

    const customerIds = customers.map(c => c.id);
    if (customerIds.length > 0) {
      console.log("\n=== INVOICE DATA ===");
      const [invoices] = await conn.query(`
        SELECT id, customer_id, invoice_number, total_amount, paid_amount, remaining_amount, status, period, due_date
        FROM invoices 
        WHERE customer_id IN (?)
      `, [customerIds]);
      console.table(invoices);

      console.log("\n=== PAYMENT TRANSACTIONS ===");
      const [payments] = await conn.query(`
        SELECT id, invoice_id, amount, status, created_at
        FROM payment_transactions 
        WHERE invoice_id IN (?)
      `, [invoices.map(i => i.id).length ? invoices.map(i => i.id) : [0]]);
      console.table(payments);

      console.log("\n=== PAYMENTS TABLE ===");
      const [paymentsTable] = await conn.query(`
        SELECT id, invoice_id, amount, status, created_at
        FROM payments 
        WHERE invoice_id IN (?)
      `, [invoices.map(i => i.id).length ? invoices.map(i => i.id) : [0]]);
      console.table(paymentsTable);
    }
    
    conn.end();
  } catch (err) {
    console.error(err);
  }
}
check();
