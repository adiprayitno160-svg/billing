import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function check() {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    const checkPort = await ssh.execCommand('netstat -tpln | grep 3011');
    console.log('Port 3011 listening:', checkPort.stdout || 'NOT LISTENING');
    ssh.dispose();
}
check();
