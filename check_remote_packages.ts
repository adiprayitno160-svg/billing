import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const res = await ssh.execCommand("mysql -u root -padi billing -e 'SELECT id, name, price, profile_id FROM pppoe_packages'");
        console.log('--- REMOTE PPPOE PACKAGES ---');
        console.log(res.stdout || 'NOT FOUND');
        // Also check profiles again to link them
        const res2 = await ssh.execCommand("mysql -u root -padi billing -e 'SELECT id, name FROM pppoe_profiles'");
        console.log('--- REMOTE PPPOE PROFILES ---');
        console.log(res2.stdout || 'NOT FOUND');
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
