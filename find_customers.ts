
import { databasePool } from './src/db/pool';

async function findCustomers() {
    try {
        const query = `
            SELECT id, name, phone, status
            FROM customers
            WHERE name LIKE '%Wildan%' OR name LIKE '%Yeni%'
        `;
        const [rows] = await databasePool.query(query);
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
findCustomers();
