import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

async function descTable() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'rtrwbilling'
    });
    try {
        const [cols] = await conn.query('DESC data_pelanggan');
        const fields = (cols as any[]).map(c => c.Field).join(', ');
        console.log("FIELDS in data_pelanggan:", fields);
    } catch (err: any) {
        console.error(err);
    } finally {
        await conn.end();
    }
}
descTable();
