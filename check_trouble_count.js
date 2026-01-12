
const { databasePool } = require('./dist/db/pool');

async function run() {
    try {
        console.log("Checking count of offline customers...");
        const [rows] = await databasePool.query(
            "SELECT COUNT(*) as count FROM static_ip_ping_status WHERE status='offline'"
        );
        console.log(JSON.stringify(rows, null, 2));

        const [rows2] = await databasePool.query(
            "SELECT COUNT(*) as count FROM sla_incidents WHERE status='ongoing'"
        );
        console.log("SLA Incidents:", JSON.stringify(rows2, null, 2));

    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

run();
