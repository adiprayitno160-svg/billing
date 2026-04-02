import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

async function listNames() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'rtrwbilling'
    });
    try {
        const [customers] = await conn.query(
            'SELECT id_pelanggan as id, nama_pelanggan as name, kode_pelanggan as customer_code FROM data_pelanggan WHERE nama_pelanggan LIKE "%KOKOM%" OR nama_pelanggan LIKE "%AGUS%"'
        );
        const custs = customers as any[];
        let output = `TOTAL CUSTOMERS: ${custs.length}\n`;
        custs.forEach(c => {
            output += `[${c.id}] ${c.name} (${c.customer_code})\n`;
        });
        fs.writeFileSync('customers_list_utf8.txt', output);
        console.log("Written to customers_list_utf8.txt");
    } catch (err: any) {
        console.error(err);
    } finally {
        await conn.end();
    }
}
listNames();
