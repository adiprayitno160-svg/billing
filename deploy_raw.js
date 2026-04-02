
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
async function deploy() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        console.log('CONNECTED');
        const remotePath = '/var/www/billing';
        console.log('Fetching...');
        await ssh.execCommand('git fetch --all', { cwd: remotePath });
        console.log('Resetting to main...');
        await ssh.execCommand('git reset --hard origin/main', { cwd: remotePath });
        console.log('Restarting PM2...');
        await ssh.execCommand('pm2 restart all', { cwd: remotePath });
        console.log('DEPLOY DONE');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
deploy();
