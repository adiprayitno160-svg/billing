
import { databasePool } from './src/db/pool';

async function checkCustomer60() {
    try {
        const [rows] = await databasePool.query('SELECT * FROM customers WHERE id = 60') as any;
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
checkCustomer60();
