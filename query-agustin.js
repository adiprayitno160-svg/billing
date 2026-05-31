const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /var/www/billing && node -e "
    const mysql = require('mysql2/promise');
    require('dotenv').config({path: '/var/www/billing/.env'});
    mysql.createConnection({
        host: process.env.DB_HOST, 
        user: process.env.DB_USER, 
        password: process.env.DB_PASSWORD, 
        database: process.env.DB_NAME
    }).then(async (c) => {
        const [rows] = await c.query('SELECT name, connection_type, pppoe_username, static_ip FROM customers WHERE name LIKE \\'%AGUSTIN%\\' OR name LIKE \\'%DIMAS HUAFI%\\'');
        console.log('Customer Data:', rows);
    }).catch(console.error);
  "`;
  
  conn.exec(remoteCmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d))
          .stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({host: '192.168.239.154', port: 22, username: 'adi', password: 'adi'});
