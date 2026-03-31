import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function check() {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    const status = await ssh.execCommand('systemctl status mysql || systemctl status mariadb');
    console.log('MySQL Status:\n', status.stdout || 'FAILED TO GET STATUS');
    const sockets = await ssh.execCommand('ls -l /run/mysqld/mysqld.sock');
    console.log('Socket existence:', sockets.stdout || 'NOT FOUND');
    ssh.dispose();
}
check();
