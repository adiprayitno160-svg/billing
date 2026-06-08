const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => {
        // Get the last 100 lines of PM2 logs for billing-app
        return ssh.execCommand('pm2 logs billing-app --lines 100 --nostream', { cwd: '/var/www/billing' });
    })
    .then(result => {
        console.log('PM2 LOGS:\n' + result.stdout);
        process.exit(0);
    })
    .catch(console.error);
