require('dotenv').config();
const { databasePool } = require('./dist/db/pool');

async function run() {
    try {
        const [rows] = await databasePool.query('SELECT COUNT(id) as count FROM invoices WHERE period = ?', ['2026-05']);
        console.log('📊 Total Invoices for 2026-05:', rows[0].count);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

run();
