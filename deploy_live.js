const { Client } = require('ssh2'); 

const conn = new Client(); 

conn.on('ready', () => { 
  console.log('SSH Ready');
  conn.exec('cd /var/www/billing && git pull origin main && npm run build && pm2 restart all', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
        console.log('Deploy complete');
        conn.end();
    })
    .on('data', d => process.stdout.write(d))
    .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({host: '192.168.239.154', port: 22, username: 'adi', password: 'adi'});
