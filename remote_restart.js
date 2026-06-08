const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => {
        console.log('Restarting PM2 billing-app...');
        return ssh.execCommand('pm2 restart billing-app', { cwd: '/var/www/billing' });
    })
    .then(result => {
        console.log('PM2 STDOUT:\n' + result.stdout);
        console.log('PM2 STDERR:\n' + result.stderr);
        process.exit(0);
    })
    .catch(console.error);
