
import { databasePool } from './src/db/pool';

async function registerTester() {
    try {
        const phone = '63729093849223';
        const [existing] = await databasePool.query('SELECT id FROM customers WHERE phone = ?', [phone]);

        if ((existing as any[]).length > 0) {
            console.log('Tester already registered');
        } else {
            await databasePool.query(
                "INSERT INTO customers (name, phone, status, billing_mode, customer_code) VALUES (?, ?, ?, ?, ?)",
                ['Tester WhatsApp', phone, 'active', 'postpaid', 'TESTWS01']
            );
            console.log('Registered Tester WhatsApp with phone:', phone);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

registerTester();
