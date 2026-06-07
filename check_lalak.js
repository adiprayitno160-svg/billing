const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'c:\\laragon\\www\\billing\\.env' });

async function check() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  const [rows] = await conn.query('SELECT pppoe_username, name FROM customers');
  console.log(rows.filter(r => r.name.toLowerCase().includes('lalak')));
  conn.end();
}
check();
