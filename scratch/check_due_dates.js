const { databasePool } = require('../dist/db/pool');
async function run() {
    try {
        const [rows] = await databasePool.execute("SELECT due_date, count(*) as count FROM invoices WHERE status != 'paid' GROUP BY due_date ORDER BY due_date DESC LIMIT 20");
        console.log('Due date distribution for unpaid invoices:');
        rows.forEach(r => {
            console.log(`Date: ${r.due_date}, Count: ${r.count}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
