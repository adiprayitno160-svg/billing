const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => {
        console.log('Checking DNS resolving github.com...');
        return ssh.execCommand('ping -c 2 github.com || echo "Ping failed"');
    })
    .then(result => {
        console.log('PING STDOUT:\\n' + result.stdout);
        console.log('PING STDERR:\\n' + result.stderr);
        
        console.log('Resolv conf:');
        return ssh.execCommand('cat /etc/resolv.conf');
    })
    .then(result => {
        console.log('RESOLV.CONF:\\n' + result.stdout);
        
        console.log('IP Config:');
        return ssh.execCommand('ip a');
    })
    .then(result => {
        console.log('IP STDOUT:\\n' + result.stdout);
        process.exit(0);
    })
    .catch(console.error);
