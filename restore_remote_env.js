const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH ready');
  const appDir = '/var/www/billing';
  
  // Script to update DB_PASSWORD in .env to BillingRoot123 and restart PM2
  const cmd = `cd "${appDir}" && sed -i 's/DB_PASSWORD=adi/DB_PASSWORD=BillingRoot123/g' .env && pm2 delete all && pm2 start ecosystem.config.js`;
  console.log('Executing:', cmd);
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('close', (code) => {
      console.log('Finished with code:', code);
      conn.end();
    })
    .on('data', (data) => process.stdout.write('[STDOUT] ' + data))
    .stderr.on('data', (data) => process.stderr.write('[STDERR] ' + data));
  });
}).on('error', (err) => {
  console.error('SSH error:', err);
}).connect({
  host: '192.168.239.154',
  port: 22,
  username: 'adi',
  password: 'adi',
  readyTimeout: 15000
});
