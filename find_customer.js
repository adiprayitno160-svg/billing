
const { databasePool } = require('./dist/db/pool');

async function run() {
    try {
        const [rows] = await databasePool.query(
            "SELECT id, name, customer_code, connection_type, status, ip_address, pppoe_username FROM customers WHERE name LIKE '%Ponakanae Kevin%'"
        );
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

run();
