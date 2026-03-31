import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function fixEnv() {
    await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
    const remotePath = '/var/www/billing';
    
    console.log('UPDATING remote .env with DB_SOCKET...');
    // Append DB_SOCKET to .env
    await ssh.execCommand('echo "DB_SOCKET=/run/mysqld/mysqld.sock" >> .env', { cwd: remotePath });
    
    console.log('RESTARTING PM2...');
    await ssh.execCommand('pm2 restart billing || pm2 restart all', { cwd: remotePath });
    
    console.log('Waiting for startup (8s)...');
    await new Promise(r => setTimeout(r, 8000));
    
    const checkPort = await ssh.execCommand('netstat -tpln | grep 3011');
    console.log('Port 3011 status:', checkPort.stdout || 'NOT LISTENING');
    
    const checkLogs = await ssh.execCommand('pm2 logs billing-app --lines 50 --nostream');
    console.log('Latest Logs:\n', checkLogs.stdout);
    
    ssh.dispose();
}
fixEnv();
