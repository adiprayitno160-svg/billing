import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

async function listDBs() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });
    try {
        const [dbs] = await conn.query('SHOW DATABASES');
        console.log("DATABASES:", JSON.stringify(dbs, null, 2));
    } catch (err: any) {
        console.error(err);
    } finally {
        await conn.end();
    }
}
listDBs();
