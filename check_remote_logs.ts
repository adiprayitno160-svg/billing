import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const res = await ssh.execCommand('tail -n 100 /var/www/billing/logs/billing-2026-03-31.log');
        console.log('--- REMOTE LOGS (last 100 lines) ---');
        console.log(res.stdout || 'NO LOGS FOUND: ' + res.stderr);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
