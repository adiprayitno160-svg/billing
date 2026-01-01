
import { databasePool } from './src/db/pool';

async function test() {
    try {
        const [rows] = await databasePool.query("SELECT id, name, pppoe_username, connection_type FROM customers WHERE connection_type = 'pppoe'");
        console.log('PPPoE Customers in DB:', rows);
    } catch (error) {
        console.error('❌ Error querying customers:', error);
    } finally {
        process.exit(0);
    }
}

test();
