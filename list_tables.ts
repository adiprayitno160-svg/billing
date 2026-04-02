import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

async function listTables() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'rtrwbilling'
    });
    try {
        const [tables] = await conn.query('SHOW TABLES');
        const list = (tables as any[]).map(t => Object.values(t)[0] as string);
        const filtered = list.filter(t => t.includes('pelanggan') || t.includes('customer') || t.includes('member') || t.includes('invoice') || t.includes('tagihan'));
        console.log("FILTERED TABLES in rtrwbilling:", filtered);
    } catch (err: any) {
        console.error(err);
    } finally {
        await conn.end();
    }
}
listTables();
