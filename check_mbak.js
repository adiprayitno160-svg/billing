const mysql = require('mysql2/promise');

async function checkCustomer() {
    console.log('Connecting to database...');
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'billing'
    });

    console.log('Connected. Running query...');
    const [rows] = await conn.execute(
        "SELECT id, name, customer_code, connection_type, pppoe_username, status, created_at FROM customers WHERE name LIKE '%MBAK%' ORDER BY created_at DESC LIMIT 20"
    );

    console.log('Found:', rows.length);
    rows.forEach(r => {
        console.log(`ID: ${r.id} | Name: ${r.name} | Code: ${r.customer_code} | Type: ${r.connection_type} | PPPoE: ${r.pppoe_username} | Status: ${r.status} | Created: ${r.created_at}`);
    });

    await conn.end();
    console.log('Done.');
}

checkCustomer().catch(e => console.error('Error:', e.message));
