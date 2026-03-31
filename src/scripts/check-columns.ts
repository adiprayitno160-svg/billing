import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';

async function check() {
    try {
        const [rows] = await databasePool.query<RowDataPacket[]>('SHOW COLUMNS FROM payments');
        console.log("Columns found in payments table:");
        rows.forEach(row => {
            console.log(`- '${row.Field}'`);
        });
    } catch (err: any) {
        console.error("FAILURE:", err.message);
    } finally {
        await databasePool.end();
    }
}

check();
