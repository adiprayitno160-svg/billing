
require('dotenv').config();
const mysql = require('mysql2/promise');

console.log('--- DEBUG ENV VARS ---');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD length:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 'UNDEFINED');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('----------------------');

async function testConnection() {
    try {
        console.log('Attemping connection...');
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        console.log('✅ Connection SUCCESS!');
        await conn.end();
    } catch (err) {
        console.error('❌ Connection FAILED:', err.message);
        console.error('Error Code:', err.code);
    }
}

testConnection();
