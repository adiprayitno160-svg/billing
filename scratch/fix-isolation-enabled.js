const { Client } = require('ssh2');

const conn = new Client();
console.log('Connecting to server...');

conn.on('ready', () => {
    console.log('Connected!\n');
    
    const mysqlCmd = `mysql -u root -p'BillingRoot123' billing -e "
    -- 1. Fix Yesi & Yunus: set isolation_enabled = 1 (janji bayar aktif)
    UPDATE customers SET isolation_enabled = 1, updated_at = NOW() 
    WHERE id IN (
        SELECT DISTINCT customer_id FROM payment_confirmations 
        WHERE status = 'approved' AND type = 'janji_bayar'
    ) AND isolation_enabled = 0;
    SELECT ROW_COUNT() as 'Customers Fixed (isolation_enabled=1)';

    -- 2. Verifikasi hasil
    SELECT c.id, c.name, c.isolation_enabled, c.is_isolated, 
           pc.status as conf_status, pc.type, pc.due_date as janji_due,
           i.status as inv_status
    FROM payment_confirmations pc
    JOIN customers c ON pc.customer_id = c.id
    LEFT JOIN invoices i ON pc.invoice_id = i.id
    ORDER BY pc.created_at DESC;
    " 2>&1`;

    conn.exec(mysqlCmd, (err, stream) => {
        if (err) { console.error('Error:', err); conn.end(); return; }
        let output = '';
        stream.on('data', d => output += d.toString())
              .on('stderr', d => output += d.toString())
              .on('close', () => { console.log(output); conn.end(); });
    });
}).on('error', err => {
    console.error('SSH Error:', err.message);
}).connect({
    host: '192.168.239.154', port: 22,
    username: 'adi', password: 'adi', readyTimeout: 10000
});
