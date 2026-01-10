
import { databasePool } from './src/db/pool';

async function fixId92() {
    console.log('--- TARGETED FIX FOR ID 92 (THE REAL GHOST) ---');
    const TARGET_ID = 92;
    const NEW_CODE = 'PONAKANAE_BARU';

    const conn = await databasePool.getConnection();
    try {
        // 1. Cek User ID 92
        const [rows]: any = await conn.query("SELECT * FROM customers WHERE id = ?", [TARGET_ID]);

        if (rows.length === 0) {
            console.log(`❌ ID ${TARGET_ID} TIDAK ADA DI DB! (Sangat aneh jika tadi ada)`);
            return;
        }

        const data = rows[0];
        console.log(`\n🔍 DATA DITEMUKAN: ID=${data.id}`);
        console.log(`Nama: "${data.name}"`);
        console.log(`Code Lama: "${data.customer_code}"`); // Mari kita lihat apakah ada \r lagi

        // 2. FIX HARD
        console.log(`\n🛠️  UPDATE CODE -> "${NEW_CODE}"`);
        await conn.query("UPDATE customers SET customer_code = ? WHERE id = ?", [NEW_CODE, TARGET_ID]);

        // Fix Static IP Client (using customer_id)
        await conn.query("UPDATE static_ip_clients SET customer_code = ? WHERE customer_id = ?", [NEW_CODE, TARGET_ID]);

        console.log('✅ SUKSES.');

        console.log('\n=============================================');
        console.log(`LINK EDIT YANG BENAR:`);
        console.log(`http://localhost:3001/customers/edit-static-ip/${NEW_CODE}`);
        console.log(`ATAU`);
        console.log(`http://localhost:3001/customers/edit-static-ip/${TARGET_ID}`);
        console.log('=============================================');

    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

fixId92();
