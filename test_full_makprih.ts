
import { CustomerNotificationService } from './src/services/customer/CustomerNotificationService';
import { WhatsAppHandler } from './src/services/whatsapp/WhatsAppHandler';
import { WhatsAppService } from './src/services/whatsapp/WhatsAppService';
import { databasePool } from './src/db/pool';

// MOCK WHATSAPP SERVICE - Agar tidak benar-benar mengirim pesan ke internet
const mockWAservice = {
    sendMessage: async (to: string, msg: string) => {
        console.log(`\n[WHATSAPP OUT -> ${to.split('@')[0]}]`);
        console.log(`MESSAGE CONTENT:\n${msg}`);
        console.log('------------------------------------------');
        return { success: true };
    }
} as unknown as WhatsAppService;

// MOCK INCOMING MESSAGE HELPER
async function sendRawMessageToBot(phone: string, text: string) {
    console.log(`\n[USER IN -> ${phone}]: "${text}"`);
    const msg = {
        key: { remoteJid: `${phone}@s.whatsapp.net`, fromMe: false, id: 'TEST-' + Date.now() },
        message: { conversation: text },
        messageTimestamp: Math.floor(Date.now() / 1000)
    };
    await WhatsAppHandler.handleIncomingMessage(msg as any, mockWAservice);
}

async function startTest() {
    const phone = '6281234567891'; // Nomor HP Mak Prih untuk test
    const customerName = 'Mak Prih (Draft)';
    const customerAddress = 'Alamat Belum Lengkap';

    console.log('🚀 MEMULAI SIMULASI PELANGGAN BARU: MAK PRIH');

    try {
        // 1. Bersihkan data lama jika ada
        await databasePool.query("DELETE FROM customers WHERE phone = ?", [phone]);
        await databasePool.query("DELETE FROM customer_wa_lids WHERE lid = ?", [`${phone}@s.whatsapp.net`]);

        // 2. Simulasi Admin Menambah Pelanggan di Dashboard
        console.log('\nStep 1: Admin menambahkan pelanggan di sistem...');
        const [result]: any = await databasePool.query(
            "INSERT INTO customers (name, phone, address, customer_code, status, connection_type) VALUES (?, ?, ?, ?, ?, ?)",
            [customerName, phone, customerAddress, 'CUST-MAK-PRIH', 'active', 'pppoe']
        );
        const customerId = result.insertId;

        // 3. Panggil service notifikasi (Otomatis mengirim Welcome & Set Session)
        console.log('\nStep 2: Sistem mengirim pesan Welcome & meminta konfirmasi...');
        const notificationService = new CustomerNotificationService();
        await notificationService.notifyNewCustomer({
            customerId,
            customerName,
            customerCode: 'CUST-MAK-PRIH',
            phone,
            address: customerAddress,
            connectionType: 'pppoe'
        });

        // 4. Simulasi Mak Prih membalas "Salah" (Ingin edit data)
        console.log('\nStep 3: Mak Prih melihat data salah dan mengetik "Salah"...');
        await sendRawMessageToBot(phone, 'Salah');

        // 5. Mak Prih mengirim nama yang benar
        console.log('\nStep 4: Mak Prih mengirim Nama yang benar...');
        await sendRawMessageToBot(phone, 'Mak Prih (Kantin)');

        // 6. Mak Prih mengirim alamat yang benar
        console.log('\nStep 5: Mak Prih mengirim Alamat yang benar...');
        await sendRawMessageToBot(phone, 'Jl. Raya Desa Sukomoro Blok C-5');

        // 7. Verifikasi Akhir di Database
        console.log('\nStep 6: Verifikasi data akhir di Database...');
        const [finalData]: any = await databasePool.query("SELECT name, address FROM customers WHERE id = ?", [customerId]);

        console.log('\n==========================================');
        console.log('HASIL AKHIR DI DATABASE:');
        console.log(`Nama: ${finalData[0].name}`);
        console.log(`Alamat: ${finalData[0].address}`);
        console.log('==========================================');

        if (finalData[0].name === 'Mak Prih (Kantin)' && finalData[0].address === 'Jl. Raya Desa Sukomoro Blok C-5') {
            console.log('✅ TEST BERHASIL: Fitur Welcome & Edit Mandiri berjalan sempurna!');
        } else {
            console.log('❌ TEST GAGAL: Data di database tidak sesuai.');
        }

    } catch (error) {
        console.error('Terjadi Error saat test:', error);
    } finally {
        await databasePool.end();
    }
}

startTest();
