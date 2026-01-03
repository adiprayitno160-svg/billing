
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSchema() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [tables] = await pool.query("SHOW TABLES LIKE 'settings'");
        console.log('Settings table:', tables);

        const [customerCols] = await pool.query("SHOW COLUMNS FROM customers LIKE '%device%'");
        console.log('Customer columns (device):', customerCols);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSchema();
