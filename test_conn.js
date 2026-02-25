
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    try {
        console.log('Testing connection to 192.168.239.154...');
        const connection = await mysql.createConnection({
            host: '192.168.239.154',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectTimeout: 5000
        });
        console.log('SUCCESS');
        await connection.end();
    } catch (err) {
        console.log('ERROR: ' + err.message);
    }
}
main();
