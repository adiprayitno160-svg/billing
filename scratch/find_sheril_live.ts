
import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();
const config = {
    host: '192.168.239.154',
    username: 'adi',
    password: 'adi'
};

async function findSherilLive() {
    try {
        await ssh.connect(config);
        
        console.log('--- Sheril Notification Logs ---');
        const res1 = await ssh.execCommand('mysql -u root -padi billing -e "SELECT n.id, n.notification_type, n.status, n.created_at, n.message FROM customer_notifications_log n WHERE n.customer_id = 118 ORDER BY n.id DESC LIMIT 5"');
        console.log(res1.stdout);

        console.log('--- Sheril Unified Queue Logs ---');
        const res2 = await ssh.execCommand('mysql -u root -padi billing -e "SELECT q.id, q.notification_type, q.status, q.created_at, q.message FROM unified_notifications_queue q WHERE q.customer_id = 118 ORDER BY q.id DESC LIMIT 5"');
        console.log(res2.stdout);

        console.log('--- Recent Invoices (April) ---');
        const res3 = await ssh.execCommand('mysql -u root -padi billing -e "SELECT i.id, i.invoice_number, i.period, c.name FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.period = \'2026-04\' ORDER BY i.id DESC LIMIT 10"');
        console.log(res3.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
}

findSherilLive();
