
import { databasePool } from './src/db/pool';

async function globalCleanup() {
    console.log('--- GLOBAL CLEANUP: REMOVING WHITESPACE/NEWLINES ---');

    const conn = await databasePool.getConnection();
    try {
        // 1. Bersihkan \r (Carriage Return)
        console.log('Cleaning \\r from customers.customer_code...');
        // MySQL TRIM tidak support \r secara langsung dengan syntax biasa di semua versi, pakai REPLACE lebih aman
        await conn.query("UPDATE customers SET customer_code = REPLACE(customer_code, '\r', '')");
        await conn.query("UPDATE customers SET customer_code = REPLACE(customer_code, '\n', '')");

        console.log('Cleaning \\r from customers.name...');
        await conn.query("UPDATE customers SET name = REPLACE(name, '\r', '')");
        await conn.query("UPDATE customers SET name = REPLACE(name, '\n', '')");

        console.log('Cleaning static_ip_clients...');
        await conn.query("UPDATE static_ip_clients SET customer_code = REPLACE(customer_code, '\r', '')");
        await conn.query("UPDATE static_ip_clients SET customer_code = REPLACE(customer_code, '\n', '')");

        console.log('\n✅ CLEANUP COMPLETE!');
        console.log('Sekarang coba akses halaman edit lagi.');

    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

globalCleanup();
