
import { databasePool } from './src/db/pool';

async function checkMoreTriggers() {
    try {
        const [payTrig] = await databasePool.query("SHOW TRIGGERS LIKE 'payments'");
        console.log('Payments Triggers:', payTrig);

        const [invTrig] = await databasePool.query("SHOW TRIGGERS LIKE 'invoices'");
        console.log('Invoices Triggers:', invTrig);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkMoreTriggers();
