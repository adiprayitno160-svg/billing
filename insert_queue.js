const { databasePool } = require('./dist/db/pool');

async function run() {
    try {
        await databasePool.query(`
            INSERT INTO unified_notifications_queue 
            (customer_id, notification_type, template_code, channel, title, message, status, priority) 
            VALUES 
            (86, 'broadcast', 'broadcast', 'whatsapp', '✅ INFO PEMBAYARAN AI DITERIMA', 'Pelanggan: *Dio / Test*\nNominal: *Rp 150.000*\nStatus: Otomatis diverifikasi dan lunas', 'pending', 'high')
        `);
        console.log('Inserted into queue');
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();