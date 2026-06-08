const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => {
        console.log('Connected!');
        return ssh.execCommand('cd /var/www/billing && git pull origin main && npm run deploy', { cwd: '/var/www/billing' });
    })
    .then(result => {
        console.log('STDOUT:\n' + result.stdout);
        console.log('STDERR:\n' + result.stderr);
        process.exit(result.code === 0 ? 0 : 1);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
