const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('curl -s -D - http://localhost:3002/billing/payments/history', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', d => process.stdout.write(d))
          .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({host: '192.168.239.154', port: 22, username: 'adi', password: 'adi'});
