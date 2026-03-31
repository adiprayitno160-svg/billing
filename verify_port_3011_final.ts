import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const res = await ssh.execCommand('netstat -tpln | grep 3011');
        console.log('--- FINAL PORT CHECK ---');
        console.log('Port 3011 listening:', res.stdout || 'NOT LISTENING');
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
