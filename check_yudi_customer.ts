import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const res = await ssh.execCommand("mysql -u root -padi billing -e 'SELECT id, name, customer_code, connection_type, pppoe_username, pppoe_password, pppoe_profile_id FROM customers WHERE name LIKE \"%YUDI SANTOSO%\"'");
        console.log('--- YUDI CUSTOMER ---');
        console.log(res.stdout || 'NOT FOUND');
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
