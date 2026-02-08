
const mysql = require('mysql2/promise');
async function check() {
    const connection = await mysql.createConnection({
        host: 'localhost', user: 'billing_user', password: 'vSn8nNVVle6WEfvP2P35LA', database: 'billing'
    });
    const [subs] = await connection.execute("SELECT id, customer_id, package_name FROM subscriptions WHERE customer_id = 210");
    console.log('SUBS LENGTH:', subs.length);
    subs.forEach(s => console.log('SUB:', s.id, s.package_name));
    await connection.end();
}
check();
