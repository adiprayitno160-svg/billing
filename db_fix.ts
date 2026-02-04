
import { databasePool } from './src/db/pool';

async function fix() {
    try {
        console.log('Checking whatsapp_bot_messages columns...');
        const [columns]: any = await databasePool.query('SHOW COLUMNS FROM whatsapp_bot_messages');
        const hasCustomerId = columns.some((c: any) => c.Field === 'customer_id');

        if (!hasCustomerId) {
            console.log('Adding customer_id column...');
            await databasePool.query('ALTER TABLE whatsapp_bot_messages ADD COLUMN customer_id INT DEFAULT NULL AFTER id, ADD INDEX (customer_id)');
            console.log('Column added successfully.');
        } else {
            console.log('Column customer_id already exists.');
        }

        // Also check if customers table has id
        const [custColumns]: any = await databasePool.query('SHOW COLUMNS FROM customers');
        const hasId = custColumns.some((c: any) => c.Field === 'id');
        console.log('Customers table has id:', hasId);

        process.exit(0);
    } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

fix();
