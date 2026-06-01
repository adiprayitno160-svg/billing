const { databasePool } = require('./dist/db/pool');
async function test() {
    const [rows] = await databasePool.query("SELECT id, name, phone FROM customers WHERE name LIKE '%dio%' OR phone LIKE '%630707%' LIMIT 5");
    console.log(rows);
    process.exit(0);
}
test();
