const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => ssh.execCommand('grep "Status-Transition" /var/www/billing/logs/pm2-out-1.log | tail -n 50'))
    .then(result => {
        console.log('STDOUT:\n' + result.stdout);
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
