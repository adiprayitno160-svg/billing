
import { databasePool } from './src/db/pool';

async function verifyId87() {
    console.log('--- VERIFICATION ID 87 ---');
    const conn = await databasePool.getConnection();
    try {
        // 1. Cek Customer
        const [cust]: any = await conn.query("SELECT id, name, customer_code FROM customers WHERE id = 87");
        console.log('Customer:', cust);

        // 2. Cek Static IP Client
        const [sic]: any = await conn.query("SELECT * FROM static_ip_clients WHERE customer_id = 87");
        console.log('Static IP Client Records:', sic.length);
        console.dir(sic, { depth: null });

        // 3. Tes Logic getStaticIpClientByCustomerId
        const [rows]: any = await conn.execute(`
            SELECT sic.* 
            FROM static_ip_clients sic
            WHERE sic.customer_id = 87 LIMIT 1
        `);
        console.log('Query Test Result:', rows.length > 0 ? 'FOUND' : 'NOT FOUND');

    } catch (err) {
    } finally {
        conn.release();
        process.exit();
    }
}

verifyId87();
