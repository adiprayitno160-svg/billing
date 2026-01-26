const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCustomerInAllDbs() {
    const dbs = ['billing', 'billing_db', 'rtrwbill', 'rtrwbilling'];

    for (const db of dbs) {
        console.log(`\n--- Checking DATABASE: ${db} ---`);
        try {
            const connection = await mysql.createConnection({
                host: process.env.DB_HOST || '127.0.0.1',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: db
            });

            try {
                // Check if customers table exists
                const [tables] = await connection.execute("SHOW TABLES LIKE 'customers'");
                if (tables.length === 0) {
                    console.log(`Table 'customers' not found in ${db}`);
                    continue;
                }

                const [count] = await connection.execute("SELECT COUNT(*) as total FROM customers");
                console.log(`Total Customers in ${db}:`, count[0].total);

                const [rows] = await connection.execute("SELECT id, name, phone FROM customers WHERE name LIKE '%Teo%' OR name LIKE '%Ady%'");
                if (rows.length > 0) {
                    console.log(`Found in ${db}:`, JSON.stringify(rows, null, 2));
                } else {
                    console.log(`No match in ${db}`);
                }
            } catch (err) {
                console.log(`Error querying ${db}: ${err.message}`);
            } finally {
                await connection.end();
            }
        } catch (err) {
            console.log(`Could not connect to ${db}: ${err.message}`);
        }
    }
}

checkCustomerInAllDbs();
