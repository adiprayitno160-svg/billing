
import { databasePool } from './src/db/pool';

async function getTesterId() {
    try {
        const [rows] = await databasePool.query('SELECT id FROM customers WHERE phone = ?', ['63729093849223']);
        console.log('Tester ID:', JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
}

getTesterId();
