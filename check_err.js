const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('grep -i "verification" /home/adi/.pm2/logs/billing-app-error.log | tail -n 20', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', d => process.stdout.write(d))
          .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({host: '192.168.239.154', port: 22, username: 'adi', password: 'adi'});
