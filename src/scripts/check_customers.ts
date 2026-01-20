
import { databasePool } from '../db/pool';

async function checkCustomers() {
    try {
        const [rows] = await databasePool.query("SELECT COUNT(*) as count FROM customers");
        console.log('Total customers:', rows);

        const [rowsCoords] = await databasePool.query("SELECT COUNT(*) as count FROM customers WHERE latitude IS NOT NULL AND longitude IS NOT NULL");
        console.log('Customers with coordinates:', rowsCoords);

        const [cols] = await databasePool.query("SHOW COLUMNS FROM customers");
        const colNames = (cols as any[]).map(c => c.Field);
        console.log('Columns:', colNames.join(', '));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkCustomers();
