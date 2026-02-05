const mysql = require('mysql2/promise');

async function checkCustomer() {
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'billing'
    });

    const [rows] = await conn.execute(
        "SELECT id, name, customer_code, connection_type, pppoe_username, ip_address, created_at FROM customers WHERE name LIKE '%ENDRAS%' ORDER BY created_at DESC"
    );

    console.log('Found customers:', rows.length);
    rows.forEach(r => {
        console.log(`ID: ${r.id}, Name: ${r.name}, Code: ${r.customer_code}, Type: ${r.connection_type}, PPPoE: ${r.pppoe_username}, Created: ${r.created_at}`);
    });

    await conn.end();
}

checkCustomer().catch(console.error);
