import { databasePool } from '../db/pool';

async function checkDiscounts() {
    try {
        const conn = await databasePool.getConnection();
        const [columns] = await conn.query("SHOW COLUMNS FROM discounts");
        console.log(JSON.stringify(columns, null, 2));
        conn.release();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDiscounts();
