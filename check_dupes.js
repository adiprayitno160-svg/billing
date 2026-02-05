const mysql = require('mysql2/promise');

async function checkCustomer() {
    console.log('Connecting to database...');
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'billing'
    });

    console.log('Connected. Running query for recently created customers...');
    const [rows] = await conn.execute(
        "SELECT id, name, customer_code, connection_type, pppoe_username, status, created_at FROM customers ORDER BY created_at DESC LIMIT 30"
    );

    console.log('Last 30 customers:');
    console.log('='.repeat(120));
    rows.forEach(r => {
        console.log(`ID: ${r.id} | Name: ${r.name} | Code: ${r.customer_code} | PPPoE: ${r.pppoe_username} | Created: ${r.created_at}`);
    });

    // Check for duplicates by name
    console.log('\n\n--- Checking for duplicate names ---');
    const [dupes] = await conn.execute(`
    SELECT name, COUNT(*) as cnt, GROUP_CONCAT(id) as ids 
    FROM customers 
    GROUP BY name 
    HAVING cnt > 1 
    ORDER BY cnt DESC 
    LIMIT 10
  `);

    if (dupes.length > 0) {
        console.log('Found duplicate names:');
        dupes.forEach(d => console.log(`Name: ${d.name} | Count: ${d.cnt} | IDs: ${d.ids}`));
    } else {
        console.log('No duplicate names found.');
    }

    await conn.end();
    console.log('\nDone.');
}

checkCustomer().catch(e => console.error('Error:', e.message));
