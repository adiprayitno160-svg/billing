
import { databasePool } from './src/db/pool';

async function checkSchema() {
    try {
        console.log('--- whatsapp_bot_messages ---');
        const [rows1] = await databasePool.query('DESCRIBE whatsapp_bot_messages');
        console.table(rows1);

        console.log('--- manual_payment_verifications ---');
        const [rows2] = await databasePool.query('DESCRIBE manual_payment_verifications');
        console.table(rows2);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkSchema();
