import mysql from 'mysql2/promise';

async function debug() {
  const connection = await mysql.createConnection({
    host: '192.168.239.154',
    user: 'root',
    password: 'adi',
    database: 'billing'
  });

  try {
    console.log('--- DEBUG CUSTOMER 90 (LALAK) ---');
    const [customer] = await connection.query('SELECT * FROM customers WHERE id = 90');
    console.log('Customer:', customer);

    const [pendingNotifs] = await connection.query('SELECT id, notification_type, status, invoice_id, message, created_at FROM unified_notifications_queue WHERE customer_id = 90 AND status = "pending"');
    console.log('Pending Notifications:', pendingNotifs);

    const [invoices] = await connection.query('SELECT id, invoice_number, status, period FROM invoices WHERE customer_id = 90');
    console.log('Invoices:', invoices);

    const [tracking] = await connection.query('SELECT * FROM customer_late_payment_tracking WHERE customer_id = 90');
    console.log('Late Payment Tracking:', tracking);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

debug();
