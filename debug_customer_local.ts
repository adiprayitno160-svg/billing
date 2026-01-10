
import { databasePool } from './src/db/pool';

async function checkCustomer() {
    const targetId = '20260110212905'; // ID LLALALAL
    console.log(`--- DEBUGGING CUSTOMER ID: ${targetId} ---`);

    try {
        const conn = await databasePool.getConnection();

        // 1. Cek tabel customers dengan ID STRING
        console.log('\n1. Checking table `customers` with String ID:');
        const [rowsStr]: any = await conn.execute('SELECT id, name, customer_code FROM customers WHERE id = ?', [targetId]);
        console.log('Result:', rowsStr);

        // 2. Cek tabel customers dengan ID NUMBER (jika driver mengizinkan)
        console.log('\n2. Checking table `customers` with Number ID (simulated):');
        try {
            const [rowsNum]: any = await conn.execute('SELECT id, name, customer_code FROM customers WHERE id = ?', [Number(targetId)]);
            console.log('Result:', rowsNum);
        } catch (e: any) {
            console.log('Error querying with Number:', e.message);
        }

        // 3. Cek tabel static_ip_clients
        console.log('\n3. Checking table `static_ip_clients` WHERE customer_id = ?:');
        const [rowsStatic]: any = await conn.execute('SELECT id, client_name, package_id FROM static_ip_clients WHERE customer_id = ?', [targetId]);
        console.log('Result:', rowsStatic);

        // 4. Cek schema tabel customers (tipe data ID)
        console.log('\n4. Checking `customers` table SCHEMA:');
        const [schema]: any = await conn.execute("SHOW COLUMNS FROM customers LIKE 'id'");
        console.log('Column Type:', schema[0]?.Type);

        conn.release();
    } catch (err) {
        console.error('Database Error:', err);
    } finally {
        process.exit();
    }
}

checkCustomer();
