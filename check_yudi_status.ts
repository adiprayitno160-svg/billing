import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const res = await ssh.execCommand("mysql -u root -padi billing -e \"SELECT i.*, c.name FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE c.name LIKE '%Yudi Santoso%' AND i.period = '2026-02'\"");
        console.log('--- YUDI FEB INVOICE ---');
        console.log(res.stdout || 'NOT FOUND');
        
        const res2 = await ssh.execCommand("mysql -u root -padi billing -e \"SELECT s.*, p.name as profile_name FROM subscriptions s LEFT JOIN pppoe_profiles p ON s.profile_id = p.id JOIN customers c ON s.customer_id = c.id WHERE c.name LIKE '%Yudi Santoso%'\"");
        console.log('--- YUDI SUBSCRIPTION ---');
        console.log(res2.stdout || 'NOT FOUND');

        const res3 = await ssh.execCommand("mysql -u root -padi billing -e \"SELECT * FROM debt_tracking WHERE customer_id = 265\""); // ID 265 from previous check
        console.log('--- YUDI DEBT TRACKING ---');
        console.log(res3.stdout || 'NOT FOUND');

        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
