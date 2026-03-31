import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function log() {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    const logs = await ssh.execCommand('pm2 logs billing-app --lines 100 --nostream');
    console.log('--- DB ERROR LOG ---');
    console.log(logs.stdout || logs.stderr);
    ssh.dispose();
}
log();
