
import { databasePool } from './src/db/pool';

async function emergencyFix92() {
    console.log('--- EMERGENCY FIX FOR ID 92 ---');

    // GANTI ID DISINI
    const TARGET_ID = 92;
    const NEW_CODE = 'PONAKANAE_92_FIXED';

    const conn = await databasePool.getConnection();
    try {
        // 1. Cari User by ID
        const [rows]: any = await conn.query("SELECT * FROM customers WHERE id = ?", [TARGET_ID]);
        if (rows.length === 0) {
            console.log(`Customer ID ${TARGET_ID} TIDAK DITEMUKAN!`);

            // Coba cari by Code yang user kasih
            const TARGET_CODE = '20260110233725';
            console.log(`Searching by Code: ${TARGET_CODE}`);
            const [rowsCode]: any = await conn.query("SELECT * FROM customers WHERE customer_code LIKE ?", [`%${TARGET_CODE}%`]);
            if (rowsCode.length > 0) {
                const c = rowsCode[0];
                console.log(`FOUND by CODE! ID: ${c.id}`);
                // Fix this one
                await fixCustomer(conn, c.id, c.name, NEW_CODE);
            } else {
                console.log('Tetap tidak ditemukan. Ghost data confirmed?');

                // Cari by created_at approx
                const [rowsTime]: any = await conn.query("SELECT * FROM customers WHERE created_at LIKE '2026-01-10 16:37:%'");
                if (rowsTime.length > 0) {
                    const c = rowsTime[0];
                    console.log(`FOUND by TIME! ID: ${c.id}`);
                    await fixCustomer(conn, c.id, c.name, NEW_CODE);
                }
            }
            return;
        }

        const customer = rows[0];
        await fixCustomer(conn, customer.id, customer.name, NEW_CODE);

    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit();
    }
}

async function fixCustomer(conn: any, id: number, name: string, newCode: string) {
    console.log(`Fixing Customer: ID=${id}, Name=${name}`);

    // Update Code
    await conn.query("UPDATE customers SET customer_code = ? WHERE id = ?", [newCode, id]);
    console.log(`✅ Customer Code diupdate menjadi: ${newCode}`);

    // Fix Static IP Client
    const [clientRows]: any = await conn.query("SELECT * FROM static_ip_clients WHERE customer_id = ?", [id]);

    if (clientRows.length === 0) {
        console.log('⚠️ Static IP Client record hilang. Membuat baru...');
        await conn.query(`
            INSERT INTO static_ip_clients 
            (package_id, client_name, ip_address, customer_id, customer_code, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())
        `, [1, name || 'Unknown', '192.168.99.99', id, newCode]);
        console.log('✅ Static IP Client record dibuat.');
    } else {
        console.log('✅ Static IP Client record ditemukan. Mengupdate code...');
        await conn.query("UPDATE static_ip_clients SET customer_code = ? WHERE customer_id = ?", [newCode, id]);
    }

    console.log('\n==================================================');
    console.log('🎉 FIX SUKSES!');
    console.log(`URL Edit: http://localhost:3001/customers/edit-static-ip/${newCode}`);
    console.log('==================================================\n');
}

emergencyFix92();
