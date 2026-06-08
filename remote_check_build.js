const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => {
        return ssh.execCommand('ls -la dist/services/monitoring/NetworkMonitoringService.js && pm2 status && cat package.json | grep main', { cwd: '/var/www/billing' });
    })
    .then(result => {
        console.log('STDOUT:\n' + result.stdout);
        console.log('STDERR:\n' + result.stderr);
        process.exit(0);
    })
    .catch(console.error);
