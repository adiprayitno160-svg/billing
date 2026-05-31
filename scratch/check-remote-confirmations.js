const { Client } = require('ssh2');

const conn = new Client();

console.log('Connecting to server 192.168.239.154...');

conn.on('ready', () => {
    console.log('Connected!\n');
    
    const mysqlCmd = `mysql -u root -p'BillingRoot123' billing -e "
    -- 1. Cek semua payment_confirmations
    SELECT '=== PAYMENT CONFIRMATIONS ===' as info;
    SELECT pc.id, pc.type, pc.status as conf_status, ROUND(pc.amount) as amount, 
           pc.due_date as janji_due, pc.created_at, pc.updated_at,
           c.name, c.isolation_enabled, c.is_isolated,
           i.status as inv_status, i.period, ROUND(i.remaining_amount) as remaining
    FROM payment_confirmations pc
    JOIN customers c ON pc.customer_id = c.id
    LEFT JOIN invoices i ON pc.invoice_id = i.id
    ORDER BY pc.created_at DESC LIMIT 20;
    
    -- 2. Yang perlu difix
    SELECT '=== PERLU DIFIX (approved tapi invoice belum janji_bayar) ===' as info;
    SELECT pc.id as conf_id, c.name, c.id as cust_id, pc.type, pc.due_date,
           i.id as inv_id, i.status as inv_status, c.isolation_enabled
    FROM payment_confirmations pc
    JOIN customers c ON pc.customer_id = c.id
    LEFT JOIN invoices i ON pc.invoice_id = i.id
    WHERE pc.status = 'approved'
    AND pc.type = 'janji_bayar'
    AND i.status NOT IN ('janji_bayar', 'paid');
    
    -- 3. Yang masih pending
    SELECT '=== MASIH PENDING ===' as info;
    SELECT pc.id, c.name, pc.type, ROUND(pc.amount) as amount, pc.created_at
    FROM payment_confirmations pc
    JOIN customers c ON pc.customer_id = c.id
    WHERE pc.status = 'pending'
    ORDER BY pc.created_at DESC;
    
    -- 4. Cek pesan SETUJU di WA log
    SELECT '=== PESAN SETUJU DI WA LOG ===' as info;
    SELECT wbm.id, c.name, wbm.phone_number, wbm.message_content, wbm.created_at
    FROM whatsapp_bot_messages wbm
    LEFT JOIN customers c ON wbm.customer_id = c.id
    WHERE LOWER(wbm.message_content) LIKE '%setuju%'
    AND wbm.direction = 'inbound'
    ORDER BY wbm.created_at DESC LIMIT 10;
    " 2>&1`;

    conn.exec(mysqlCmd, (err, stream) => {
        if (err) {
            console.error('Error:', err);
            conn.end();
            return;
        }

        let output = '';
        stream.on('data', (d) => {
            output += d.toString();
        }).on('stderr', (d) => {
            output += d.toString();
        }).on('close', () => {
            console.log(output);
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('SSH Error:', err.message);
}).connect({
    host: '192.168.239.154',
    port: 22,
    username: 'adi',
    password: 'adi',
    readyTimeout: 10000
});
