const db = require('./dist/db/pool').default;
db.query("SELECT c.name, s.status, s.last_offline_at FROM customers c JOIN static_ip_ping_status s ON c.id=s.customer_id WHERE c.name LIKE '%ALINA%'")
  .then(r => { console.log(r[0]); process.exit(0); })
  .catch(console.error);
