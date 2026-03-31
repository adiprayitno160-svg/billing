import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        // Try without sudo first (since we are adi)
        const res1 = await ssh.execCommand('chmod -R 775 /var/www/billing/logs');
        const res2 = await ssh.execCommand('ls -ld /var/www/billing/logs');
        console.log('--- PERMISSION FIX RESULTS ---');
        console.log(res2.stdout);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
