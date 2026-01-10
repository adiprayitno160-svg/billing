
import { databasePool } from './src/db/pool';

async function emergencyFix() {
    console.log('--- EMERGENCY FIX FOR PONAKANAE ---');

    const TARGET_NAME = 'Ponakanae';
    const NEW_CODE = 'PONAKANAE_FIXED'; // Kode baru yang bersih

    const conn = await databasePool.getConnection();
    try {
        // 1. Cari User
        const [rows]: any = await conn.query("SELECT * FROM customers WHERE name LIKE ?", [`%${TARGET_NAME}%`]);
        if (rows.length === 0) {
            console.log('Customer Ponakanae tidak ditemukan dengan query LIKE name!');
            return;
        }

        const customer = rows[rows.length - 1]; // Ambil yang paling baru (ID 92)
        console.log(`Target Customer: ID=${customer.id}, Name=${customer.name}, OldCode=${customer.customer_code}`);

        // 2. Update Customer Code jadi bersih
        await conn.query("UPDATE customers SET customer_code = ? WHERE id = ?", [NEW_CODE, customer.id]);
        console.log(`✅ Customer Code diupdate menjadi: ${NEW_CODE}`);

        // 3. Cek & Fix Static IP Client
        const [clientRows]: any = await conn.query("SELECT * FROM static_ip_clients WHERE customer_id = ?", [customer.id]);

        if (clientRows.length === 0) {
            console.log('⚠️ Static IP Client record hilang. Membuat baru...');
            await conn.query(`
                INSERT INTO static_ip_clients 
                (package_id, client_name, ip_address, customer_id, customer_code, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())
            `, [1, customer.name, '192.168.0.0', customer.id, NEW_CODE]); // Dummy IP/Paket
            console.log('✅ Static IP Client record dibuat.');
        } else {
            console.log('✅ Static IP Client record ditemukan. Mengupdate code...');
            await conn.query("UPDATE static_ip_clients SET customer_code = ? WHERE customer_id = ?", [NEW_CODE, customer.id]);
        }

        console.log('\n==================================================');
        console.log('🎉 PERBAIKAN SELESAI!');
        console.log(`Silakan akses URL ini untuk mengedit pelanggan:`);
        console.log(`http://localhost:3001/customers/edit-static-ip/${NEW_CODE}`);
        console.log(`ATAU`);
        console.log(`http://localhost:3001/customers/edit-static-ip/${customer.id}`);
        console.log('==================================================\n');

    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

emergencyFix();
