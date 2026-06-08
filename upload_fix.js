const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => {
        console.log('Connected! Uploading NetworkMonitoringService.ts...');
        return ssh.putFile('c:\\\\laragon\\\\www\\\\billing\\\\src\\\\services\\\\monitoring\\\\NetworkMonitoringService.ts', '/var/www/billing/src/services/monitoring/NetworkMonitoringService.ts');
    })
    .then(() => {
        console.log('Upload successful. Compiling TypeScript...');
        return ssh.execCommand('npx tsc', { cwd: '/var/www/billing' });
    })
    .then(result => {
        console.log('TSC STDOUT:\n' + result.stdout);
        console.log('TSC STDERR:\n' + result.stderr);
        console.log('Restarting PM2...');
        return ssh.execCommand('pm2 restart billing', { cwd: '/var/www/billing' });
    })
    .then(result => {
        console.log('PM2 STDOUT:\n' + result.stdout);
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
