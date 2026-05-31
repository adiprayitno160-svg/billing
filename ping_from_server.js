const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("ping -c 4 192.168.239.10", (err, stream) => {
    stream.on('data', d => process.stdout.write(d))
          .stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({host: '192.168.239.154', port: 22, username: 'adi', password: 'adi'});
