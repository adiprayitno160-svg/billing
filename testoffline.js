const db = require('./dist/db/pool').default;
db.query("SELECT COUNT(*) as c FROM customers c JOIN static_ip_ping_status s ON c.id=s.customer_id WHERE c.connection_type='pppoe' AND s.status='offline'")
  .then(r => { console.log("Offline PPPoE Count:", r[0]); process.exit(0); })
  .catch(console.error);
