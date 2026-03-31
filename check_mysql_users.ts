import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        // Use sudo to check mysql users. Output password directly for sudo.
        const res = await ssh.execCommand('echo adi | sudo -S mysql -e "SELECT User, Host FROM mysql.user"');
        console.log('--- MYSQL USERS ---');
        console.log(res.stdout || res.stderr);
        ssh.dispose();
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
run();
