const { databasePool } = require('../dist/db/pool');
async function run() {
    try {
        const [rows] = await databasePool.execute("SELECT id, name, billing_day FROM customers WHERE status = 'active' AND billing_day = 28");
        console.log(`Found ${rows.length} active customers with billing day 28.`);
        rows.forEach(r => console.log(`ID: ${r.id}, Name: ${r.name}`));
    } catch (e) { console.error(e); } finally { process.exit(); }
}
run();
