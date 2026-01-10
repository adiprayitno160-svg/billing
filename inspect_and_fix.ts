
import { databasePool } from './src/db/pool';

async function inspectAndFix() {
    console.log('--- INSPECT AND FIX PONAKANAE ---');
    const conn = await databasePool.getConnection();
    try {
        // 1. CARI DATA
        const [rows]: any = await conn.query("SELECT id, name, customer_code FROM customers WHERE name LIKE '%Ponakanae%'");

        if (rows.length === 0) {
            console.log('❌ PONAKANAE TIDAK DITEMUKAN DI DB!');
            return;
        }

        const data = rows[0]; // Ambil yang pertama
        console.log(`\n🔍 DATA DITEMUKAN: ID=${data.id}`);
        console.log(`Nama: "${data.name}"`);
        console.log(`Code: "${data.customer_code}"`);

        // Dump bytes dari customer_code
        const code = data.customer_code || '';
        const bytes = [];
        for (let i = 0; i < code.length; i++) {
            bytes.push(code.charCodeAt(i));
        }
        console.log(`Code Bytes: [${bytes.join(', ')}]`);

        if (bytes.includes(13)) console.log('⚠️ TERDETEKSI: Carriage Return (\\r)');
        if (bytes.includes(10)) console.log('⚠️ TERDETEKSI: Newline (\\n)');
        if (bytes.includes(32)) console.log('⚠️ TERDETEKSI: Spasi');

        // 2. FORCE FIX
        const NEW_CODE = 'PONAKANAE123';
        console.log(`\n🛠️  MENGUBAH CODE MENJADI: "${NEW_CODE}"...`);

        await conn.query("UPDATE customers SET customer_code = ? WHERE id = ?", [NEW_CODE, data.id]);
        await conn.query("UPDATE static_ip_clients SET customer_code = ? WHERE customer_id = ?", [NEW_CODE, data.id]);

        console.log('✅ BERHASIL DIUBAH.');

        // 3. VERIFIKASI
        const [check]: any = await conn.query("SELECT customer_code FROM customers WHERE id = ?", [data.id]);
        console.log(`Code Sekarang: "${check[0].customer_code}"`);

        console.log('\n=============================================');
        console.log(`SILAKAN BUKA URL INI UNTUK EDIT:`);
        console.log(`http://localhost:3001/customers/edit-static-ip/${NEW_CODE}`);
        console.log(`ATAU`);
        console.log(`http://localhost:3001/customers/edit-static-ip/${data.id}`);
        console.log('=============================================');

    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

inspectAndFix();
