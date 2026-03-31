import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function verify() {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    const checkPort = await ssh.execCommand('netstat -tpln | grep 3002');
    console.log('Port 3002 listening:', checkPort.stdout || 'NOT LISTENING');
    const pm2List = await ssh.execCommand('pm2 list');
    console.log('PM2 List:\n', pm2List.stdout);
    ssh.dispose();
}
verify();
