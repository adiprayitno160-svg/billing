import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        // Use tail instead of pm2 logs to be sure
        const res = await ssh.execCommand('tail -n 100 /home/adi/.pm2/logs/billing-app-error.log');
        console.log('--- REMOTE ERROR LOGS ---');
        console.log(res.stdout || 'NOT FOUND: ' + res.stderr);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
