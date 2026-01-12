
const { databasePool } = require('./dist/db/pool');

async function run() {
    try {
        await databasePool.query(
            `INSERT INTO static_ip_ping_status 
            (customer_id, ip_address, status, packet_loss_percent, consecutive_failures, last_check, last_offline_at) 
            VALUES (?, '192.168.5.2', 'offline', 100, 5, NOW(), NOW())
            ON DUPLICATE KEY UPDATE 
            status = 'offline', packet_loss_percent = 100, last_check = NOW(), last_offline_at = NOW()`,
            [87]
        );
        console.log("Simulated offline status for customer 87");
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

run();
