const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/customers/60',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        const hasONT = data.includes('ONT') || data.includes('Status Perangkat');
        const hasOldSerial = data.includes('ZTEGC8B8FD96'); // Serial lama (test)
        const hasCorrectSerial = data.includes('4857544365A5A895'); // Serial benar (dari GenieACS)
        const hasDeviceDetails = data.includes('deviceDetails');
        const hasSerialField = data.includes('serial_number');

        console.log('\n📊 Check hasil:');
        console.log('========================================');
        console.log('✅ Contains "ONT" text:', hasONT);
        console.log('✅ Contains CORRECT Serial (4857544365A5A895):', hasCorrectSerial);
        console.log('✅ Contains OLD Serial (ZTEGC8B8FD96):', hasOldSerial);
        console.log('✅ Contains deviceDetails variable:', hasDeviceDetails);
        console.log('✅ Contains serial_number field:', hasSerialField);
        console.log('========================================\n');

        if (hasONT && hasCorrectSerial) {
            console.log('🎉 SUCCESS! ONT Status Card dengan SN yang benar muncul!');
            console.log('🔗 Buka: http://localhost:3001/customers/60');
        } else if (hasONT && !hasCorrectSerial && !hasDeviceDetails) {
            console.log('❌ ONT Status Card masih belum muncul');
            console.log('📝 Template ONT: ADA');
            console.log('📝 Serial Number dari DB: TIDAK TER-RENDER di HTML');
            console.log('\n💡 Kemungkinan masalah:');
            console.log('   - Controller tidak fetch serial_number dari database');
            console.log('   - Query SQL tidak include field serial_number');
            console.log('   - Template tidak receive variable customer.serial_number');
        } else {
            console.log('⚠️ Status parsial - cek detail di atas');
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.end();
