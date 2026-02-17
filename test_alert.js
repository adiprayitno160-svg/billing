/**
 * Test Script: Send NOC Alert to Admin
 * Tests both individual customer alert and mass outage alert
 */
const { databasePool } = require('./dist/db/pool');

async function testAlert() {
    try {
        console.log('=== TEST NOC ALERT ===');

        // Wait for WhatsApp to initialize
        const waService = require('./dist/services/whatsapp/WhatsAppService').default;

        console.log('Waiting for WhatsApp service to be ready...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const testPhone = '089678630707';

        // Test 1: Individual Customer Offline Alert
        const alertMsg = `🔴 *ALERT: PELANGGAN OFFLINE*\n\n` +
            `👤 Nama: *TEST PELANGGAN*\n` +
            `🏠 Alamat: Jl. Test Alamat No. 123\n` +
            `📦 ODP: ODP-TEST-001\n` +
            `🆔 ID: CUST-TEST-001\n` +
            `📡 Layanan: PPPOE\n` +
            `⏰ Waktu: ${new Date().toLocaleString('id-ID')}`;

        console.log(`Sending individual alert to ${testPhone}...`);
        await waService.sendMessage(testPhone, alertMsg);
        console.log('✅ Individual alert sent!');

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 2: Mass Outage ODP Alert
        const massMsg = `🚨 *GANGGUAN MASAL: ODP DOWN*\n\n` +
            `📍 ODP: *ODP-TEST-001*\n` +
            `📉 Status: TERPUTUS / DOWN\n` +
            `👥 Pelanggan Terdampak: 5 orang\n` +
            `⏰ Waktu: ${new Date().toLocaleString('id-ID')}\n\n` +
            `⚠️ Mohon segera dicek oleh tim teknis di lokasi.`;

        console.log(`Sending mass outage alert to ${testPhone}...`);
        await waService.sendMessage(testPhone, massMsg);
        console.log('✅ Mass outage alert sent!');

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 3: ODP Recovery Alert
        const recoveryMsg = `✅ *ODP PULIH KEMBALI*\n\n` +
            `📍 ODP: *ODP-TEST-001*\n` +
            `📉 Status: NORMAL KEMBALI\n` +
            `👥 Pelanggan Terdampak: 0 orang\n` +
            `⏰ Waktu: ${new Date().toLocaleString('id-ID')}\n\n` +
            `🎉 Koneksi telah stabil kembali.`;

        console.log(`Sending recovery alert to ${testPhone}...`);
        await waService.sendMessage(testPhone, recoveryMsg);
        console.log('✅ Recovery alert sent!');

        console.log('\n=== ALL TEST ALERTS SENT SUCCESSFULLY ===');

        setTimeout(() => process.exit(0), 3000);

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testAlert();
