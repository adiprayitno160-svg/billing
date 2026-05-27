const { Client } = require('ssh2');
const conn = new Client();
const envContent = `PORT=3011
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=BillingRoot123
DB_NAME=billing
JWT_SECRET=rahasia123
WA_SESSION_PATH=./session
DISABLE_WHATSAPP=false
GEMINI_API_KEY=`;

conn.on('ready', () => {
  conn.exec(`echo "${envContent}" > /var/www/billing/.env && pm2 restart all`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', d => process.stdout.write(d))
          .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({host: '192.168.239.154', port: 22, username: 'adi', password: 'adi'});
