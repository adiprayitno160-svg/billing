
import { databasePool } from './src/db/pool';

async function checkSchema() {
    try {
        const [subRows] = await databasePool.query("SHOW COLUMNS FROM subscriptions");
        const [actRows] = await databasePool.query("SHOW TABLES LIKE 'activation_logs'");
        const [notifCols] = await databasePool.query("SHOW COLUMNS FROM unified_notifications_queue");

        console.log("--- subscriptions ---");
        (subRows as any[]).forEach(c => console.log(c.Field));

        console.log("\n--- tables check ---");
        console.log("activation_logs exists:", (actRows as any[]).length > 0);

        console.log("\n--- unified_notifications_queue ---");
        (notifCols as any[]).forEach(c => console.log(c.Field));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
checkSchema();
