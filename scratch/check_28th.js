const { databasePool } = require('../dist/db/pool');
async function run() {
    try {
        const [rows] = await databasePool.execute("SELECT id, status, due_date, remaining_amount FROM invoices WHERE due_date = '2026-04-28'");
        console.log(`Found ${rows.length} invoices due on 2026-04-28.`);
        rows.forEach(r => {
            console.log(`ID: ${r.id}, Status: ${r.status}, Remaining: ${r.remaining_amount}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
