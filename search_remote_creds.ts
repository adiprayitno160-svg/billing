import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        // Look for mysql.createConnection or createPool calls
        const res = await ssh.execCommand('grep -R "mysql" . --include="*.js" --include="*.ts" | grep -iE "user|pass" -C 2', { cwd: '/var/www/billing' });
        console.log('--- REMOTE SOURCE CREDS SEARCH ---');
        console.log(res.stdout || res.stderr);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
