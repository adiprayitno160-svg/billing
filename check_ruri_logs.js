const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  const cmd = `grep -i -C 2 'ruri' /var/www/billing/logs/pm2-out-14.log /var/www/billing/logs/pm2-out-12.log /var/www/billing/logs/pm2-error-14.log /var/www/billing/logs/pm2-error-12.log`; 
  conn.exec(cmd, (err, stream) => { 
    stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d)).stderr.on('data', d => process.stderr.write(d)); 
  }); 
}).connect({host: '192.168.239.154', port: 22, username: 'adi', password: 'adi'});
