const pool = require('./src/db/pool').databasePool;
pool.query(`
    UPDATE notification_templates 
    SET message_template = REPLACE(message_template, 'Ketik *Menu* untuk cek tagihan atau bantuan lainnya.', '💡 *BUTUH WAKTU TAMBAHAN?*\\nJika Anda ingin mengajukan janji bayar, silakan balas pesan ini dengan mengetik: *JANJIBAYAR*\\n\\nKetik *Menu* untuk cek tagihan atau bantuan lainnya.') 
    WHERE template_code IN ('service_blocked_system', 'service_blocked')
`).then(res => {
    console.log('Updated DB rows:', res[0].affectedRows);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
