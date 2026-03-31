import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const res = await ssh.execCommand('cat ecosystem.config.js', { cwd: '/var/www/billing' });
        console.log('--- ECOSYSTEM CONFIG ---');
        console.log(res.stdout || res.stderr);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
