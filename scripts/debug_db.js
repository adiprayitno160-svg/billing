
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkSettings() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [settings] = await connection.query('SELECT * FROM ai_settings');
        console.log('AI Settings:', JSON.stringify(settings, null, 2));

        const [customers] = await connection.query('SELECT id, name, phone, billing_mode FROM customers LIMIT 5');
        console.log('Customers:', JSON.stringify(customers, null, 2));

        if (customers.length > 0) {
            const [invoices] = await connection.query('SELECT * FROM invoices WHERE customer_id = ? AND status != "paid"', [customers[0].id]);
            console.log('Invoices for Customer ' + customers[0].id + ':', JSON.stringify(invoices, null, 2));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

checkSettings();
