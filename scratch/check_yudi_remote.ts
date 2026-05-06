import { Client } from 'ssh2';
import * as dotenv from 'dotenv';

const config = {
    host: '192.168.239.154',
    port: 22,
    username: 'adi',
    password: 'adi'
};

async function checkYudi() {
    const conn = new Client();
    conn.on('ready', () => {
        console.log('SSH Ready');
        const query = "mysql -u root billing -e 'SELECT name, status, is_isolated, isolated_at FROM customers WHERE name LIKE \"%yudi%\"; SELECT c.name, i.period, i.status, i.remaining_amount, i.due_date FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE c.name LIKE \"%yudi%\" AND i.status != \"paid\" ORDER BY i.period DESC; SELECT * FROM isolation_logs WHERE customer_id = (SELECT id FROM customers WHERE name LIKE \"%yudi%\" LIMIT 1) ORDER BY created_at DESC LIMIT 5;'";
        conn.exec(query, (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                conn.end();
            }).on('data', (data) => {
                console.log('STDOUT: ' + data);
            }).stderr.on('data', (data) => {
                console.log('STDERR: ' + data);
            });
        });
    }).connect(config);
}

checkYudi().catch(console.error);
