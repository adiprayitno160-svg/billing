const { databasePool } = require('../dist/db/pool');
async function run() {
    try {
        const [rows] = await databasePool.execute("SELECT due_date, status, count(*) as count FROM invoices GROUP BY due_date, status ORDER BY due_date DESC LIMIT 50");
        console.log('Invoice Due Date & Status distribution:');
        rows.forEach(r => {
            console.log(`Date: ${r.due_date}, Status: ${r.status}, Count: ${r.count}`);
        });
    } catch (e) { console.error(e); } finally { process.exit(); }
}
run();
