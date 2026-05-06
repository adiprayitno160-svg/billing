import { Client } from 'ssh2';

const sshConfig = {
    host: '192.168.239.154',
    port: 22,
    username: 'adi',
    password: 'adi'
};

async function checkYudi() {
    const conn = new Client();
    conn.on('ready', () => {
        console.log('SSH Ready');
        // Combined query with proper credentials
        const query = `mysql -u billing_user -pvSn8nNVVle6WEfvP2P35LA billing -e "
            SELECT id, name, status, is_isolated, isolated_at, pppoe_username, connection_type FROM customers WHERE name LIKE '%yudi%' OR name LIKE '%santoso%';
            
            SELECT c.name, i.period, i.status as inv_status, i.remaining_amount, i.due_date 
            FROM invoices i 
            JOIN customers c ON i.customer_id = c.id 
            WHERE (c.name LIKE '%yudi%' OR c.name LIKE '%santoso%') AND (i.status != 'paid' OR i.status = 'hutang') AND i.remaining_amount > 0
            ORDER BY i.period DESC;
            
            SELECT l.action, l.reason, l.performed_by, l.created_at 
            FROM isolation_logs l 
            JOIN customers c ON l.customer_id = c.id 
            WHERE c.name LIKE '%yudi%' OR c.name LIKE '%santoso%'
            ORDER BY l.created_at DESC LIMIT 5;
        "`;
        
        conn.exec(query, (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                conn.end();
            }).on('data', (data) => {
                console.log(String(data));
            }).stderr.on('data', (data) => {
                if (!String(data).includes('Using a password on the command line interface can be insecure')) {
                    console.log('STDERR: ' + data);
                }
            });
        });
    }).connect(sshConfig);
}

checkYudi().catch(console.error);
