const { Client } = require('ssh2'); 
const conn = new Client(); 

conn.on('ready', () => { 
  const cmd = `mysql -u root -pBillingRoot123 billing -e "SELECT id, name FROM customers WHERE name LIKE '%dipma%' OR name LIKE '%geprekin%'; SELECT id, customer_id, invoice_number, total_amount, paid_amount, remaining_amount, status FROM invoices WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE '%dipma%' OR name LIKE '%geprekin%');"`; 
  conn.exec(cmd, (err, stream) => { 
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d)).stderr.on('data', d => process.stderr.write(d)); 
  }); 
}).connect({host: '192.168.239.154', port: 22, username: 'adi', password: 'adi'});
