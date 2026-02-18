
const mysql = require('mysql2/promise');
async function test() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            database: 'billing'
        });
        console.log('Connected!');
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM invoices');
        console.log('Invoices:', rows[0].count);
        await connection.end();
    } catch (e) {
        console.error(e);
    }
}
test();
