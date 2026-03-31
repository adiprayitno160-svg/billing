import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function check() {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    const env = await ssh.execCommand('cat .env', { cwd: '/var/www/billing' });
    console.log('--- REMOTE .ENV ---');
    console.log(env.stdout || 'EMPTY OR MISSING .ENV');
    ssh.dispose();
}
check();
