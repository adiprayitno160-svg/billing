
const mysql = require('/var/www/billing/node_modules/mysql2/promise');
mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'BillingRoot123',
  database: 'billing'
}).then(async c => {
  // Cari customer Bagyo dulu
  const [customers] = await c.query("SELECT id, name FROM customers WHERE name LIKE '%agyo%' OR name LIKE '%Bagyo%' LIMIT 5");
  console.log('CUSTOMERS:', JSON.stringify(customers, null, 2));
  
  if (customers.length > 0) {
    const cid = customers[0].id;
    
    // Payments
    const [payments] = await c.query(
      "SELECT p.id, DATE_FORMAT(p.created_at,'%Y-%m-%d %H:%i') as created, p.notes, p.payment_method, p.amount, i.status, i.invoice_number FROM payments p JOIN invoices i ON p.invoice_id=i.id WHERE i.customer_id = ? ORDER BY p.created_at DESC LIMIT 10",
      [cid]
    );
    console.log('PAYMENTS:', JSON.stringify(payments, null, 2));
    
    // Notifications
    const [notifs] = await c.query(
      "SELECT id, notification_type, status, DATE_FORMAT(sent_at,'%Y-%m-%d %H:%i') as sent, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i') as created, channel FROM notifications WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10",
      [cid]
    );
    console.log('NOTIFICATIONS:', JSON.stringify(notifs, null, 2));
  }
  
  await c.end();
}).catch(e => console.error('ERR:', e.message));
