
import { databasePool } from './src/db/pool';

async function listPonakan() {
    console.log('--- LIST ALL PONAKAN ---');
    const conn = await databasePool.getConnection();
    try {
        const [rows]: any = await conn.query("SELECT id, name, customer_code, created_at FROM customers WHERE name LIKE '%Ponakan%'");
        console.log(`Found ${rows.length} Ponakans:`);
        console.table(rows);
    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

listPonakan();
