
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    console.log("=== CHECKING MIKROTIK SETTINGS IN DB ===");
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [rows] = await conn.execute('SELECT * FROM mikrotik_settings');
    console.log("Rows found:", rows.length);
    if (rows.length > 0) {
        rows.forEach(row => {
            console.log(`ID: ${row.id}`);
            console.log(`Host: ${row.host}`);
            console.log(`Username: ${row.username}`);
            console.log(`Port: ${row.port}`);
            // Don't log full password for security, just length or first char
            console.log(`Password Length: ${row.password ? row.password.length : 0}`);
        });
    } else {
        console.log("No settings found!");
    }

    // Also check the specific customer again just to be sure we are looking at the right one
    const [cust] = await conn.execute("SELECT id, name, ip_address FROM customers WHERE name LIKE '%Ponakanae%'");
    console.log("Customer:", cust);

    conn.end();
}

run();
