import { databasePool } from './src/db/pool';

async function check() {
    try {
        console.log('Checking for 089678630707...');
        const [rows] = await databasePool.query('SELECT id, name, phone FROM customers WHERE phone LIKE ?', ['%89678630707%']);
        console.log('Result:', rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
