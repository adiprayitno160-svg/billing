import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const res = await ssh.execCommand('pm2 list');
        console.log('--- REMOTE PM2 LIST ---');
        console.log(res.stdout || 'NOT FOUND: ' + res.stderr);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
