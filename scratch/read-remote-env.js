const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    conn.exec('cat /var/www/billing/.env', (err, stream) => {
        if (err) { console.error(err); conn.end(); return; }
        let data = '';
        stream.on('data', d => data += d.toString())
              .on('close', () => { console.log(data); conn.end(); });
    });
}).connect({
    host: '192.168.239.154',
    port: 22,
    username: 'adi',
    password: 'adi',
    readyTimeout: 10000
});
