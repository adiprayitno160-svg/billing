import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const res = await ssh.execCommand("mysql -u root -padi billing -e 'SELECT * FROM payments WHERE invoice_id = 850'");
        console.log('--- YUDI FEB PAYMENT ---');
        console.log(res.stdout || 'NOT FOUND');
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
