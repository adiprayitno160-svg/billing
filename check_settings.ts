import { databasePool } from './src/db/pool';

async function checkSettings() {
    try {
        const [rows] = await databasePool.query("SELECT * FROM scheduler_settings WHERE task_name='invoice_generation'");
        console.log('Scheduler Config:', JSON.stringify(rows, null, 2));

        const [sysRows] = await databasePool.query("SELECT * FROM system_settings WHERE category='billing' OR setting_key LIKE 'bank_%'");
        console.log('Billing Config:', JSON.stringify(sysRows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkSettings();
