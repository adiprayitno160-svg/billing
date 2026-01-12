
const { databasePool } = require('./dist/db/pool');

async function run() {
    try {
        const [rows] = await databasePool.query(
            "SELECT * FROM static_ip_ping_status WHERE customer_id = 87"
        );
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

run();
