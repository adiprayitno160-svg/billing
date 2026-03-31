import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function log() {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    const logs = await ssh.execCommand('pm2 logs billing-app --lines 50 --nostream');
    console.log('--- PM2 LOGS ---');
    console.log(logs.stdout || logs.stderr);
    ssh.dispose();
}
log();
