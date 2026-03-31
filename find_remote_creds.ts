import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        // Use a simpler string to avoid Shell escaping hell
        const res = await ssh.execCommand('grep -ri "mysql" . --exclude-dir=node_modules --include="*.js" --include="*.ts" | grep -iE "user|password" | head -n 50', { cwd: '/var/www/billing' });
        console.log('--- REMOTE SOURCE CREDS SEARCH ---');
        console.log(res.stdout || res.stderr);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
