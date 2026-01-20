import { databasePool } from './src/db/pool';

async function findCustomer() {
    try {
        const [rows] = await databasePool.query('SELECT id, name, customer_code FROM customers LIMIT 10');
        console.log('Customers:');
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error finding customers:', error);
    } finally {
        process.exit();
    }
}

findCustomer();
