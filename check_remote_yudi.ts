import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const res = await ssh.execCommand('ls -l yudi_feb_gen.js', { cwd: '/var/www/billing' });
        console.log('--- REMOTE YUDI CHECK ---');
        console.log(res.stdout || 'NOT FOUND: ' + res.stderr);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
