const mysql = require('mysql2/promise');
mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'billing'
}).then(async conn => {
    try {
        const [customers] = await conn.query('SELECT id, name, pppoe_profile_id, connection_type FROM customers WHERE id = 272');
        console.log('Customer:', customers);
        const [subs] = await conn.query('SELECT * FROM subscriptions WHERE customer_id = 272');
        console.log('Subscriptions:', subs);
    } catch(err) {
        console.error(err);
    }
    process.exit(0);
});
