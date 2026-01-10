
import { databasePool } from './src/db/pool';

async function findRealID() {
    const conn = await databasePool.getConnection();
    try {
        console.log('Searching for LLALALAL...');
        const [rows]: any = await conn.query("SELECT id, name, customer_code FROM customers WHERE name LIKE '%LLALALAL%'");
        console.log('Customers found:', rows);

        console.log('Searching for Ponakanae...');
        const [rows2]: any = await conn.query("SELECT id, name, customer_code FROM customers WHERE name LIKE '%Ponakanae%'");
        console.log('Customers found:', rows2);

    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

findRealID();
