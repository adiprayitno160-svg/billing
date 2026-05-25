const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH ready');
  const appDir = '/var/www/billing';
  const cmd = `pm2 list && echo "=== PM2 LOGS ===" && pm2 logs billing-app --no-daemon --lines 30`;
  console.log('Executing:', cmd);
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    // Set a timeout to close the connection because pm2 logs --no-daemon might hang
    const timer = setTimeout(() => {
        console.log('Timeout reached, closing stream.');
        stream.destroy();
        conn.end();
    }, 8000);

    stream.on('close', (code) => {
      console.log('Command finished with code', code);
      clearTimeout(timer);
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
