import { databasePool } from './src/db/pool';

async function checkSchema() {
    try {
        console.log('--- Table: payments ---');
        const [paymentsCols] = await databasePool.query('DESC payments');
        console.log(JSON.stringify(paymentsCols, null, 2));

        console.log('\n--- Table: invoices ---');
        const [invoicesCols] = await databasePool.query('DESC invoices');
        console.log(JSON.stringify(invoicesCols, null, 2));

        console.log('\n--- Table: notifications ---');
        try {
            const [notifCols] = await databasePool.query('DESC notifications');
            console.log(JSON.stringify(notifCols, null, 2));
        } catch (e) {
            console.log('notifications table not found or error');
        }

    } catch (error) {
        console.error('Error checking schema:', error);
    } finally {
        process.exit(0);
    }
}

checkSchema();
