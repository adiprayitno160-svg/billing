import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function fix() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        const remotePath = '/var/www/billing';
        
        console.log('UPDATING remote .env with PASSWORD=adi and SOCKET...');
        // 1. Set Password
        await ssh.execCommand("sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=adi/' .env", { cwd: remotePath });
        // 2. Set (or Update) Socket
        await ssh.execCommand("grep -q '^DB_SOCKET=' .env && sed -i 's|^DB_SOCKET=.*|DB_SOCKET=/run/mysqld/mysqld.sock|' .env || echo 'DB_SOCKET=/run/mysqld/mysqld.sock' >> .env", { cwd: remotePath });
        
        console.log('--- FINAL .ENV CHECK ---');
        const env = await ssh.execCommand('cat .env', { cwd: remotePath });
        console.log(env.stdout);

        console.log('RESTARTING PM2...');
        await ssh.execCommand('pm2 restart all', { cwd: remotePath });
        
        console.log('Waiting for startup (10s)...');
        await new Promise(r => setTimeout(r, 10000));
        
        const checkPort = await ssh.execCommand('netstat -tpln | grep 3011');
        console.log('Port 3011 listening:', checkPort.stdout || 'NOT LISTENING');
        
        const logs = await ssh.execCommand('pm2 logs billing-app --lines 20 --nostream');
        console.log('Final Logs:\n', logs.stdout);

        ssh.dispose();
    } catch (err: any) {
        console.error('ERROR:', err.message);
    }
}
fix();
