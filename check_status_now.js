
const { databasePool } = require('./dist/db/pool');

async function run() {
    try {
        console.log("Checking DB Status for Ponakanae Kevin...");
        const [rows] = await databasePool.query(
            "SELECT sips.customer_id, sips.status, sips.last_check, c.is_isolated, c.name, c.ip_address FROM static_ip_ping_status sips JOIN customers c ON c.id = sips.customer_id WHERE c.name LIKE '%Ponakanae Kevin%'"
        );
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

run();
