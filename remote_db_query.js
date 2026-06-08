const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => ssh.execCommand('node -e "require(\'./dist/db/pool\').databasePool.query(\'SELECT name, connection_type FROM customers WHERE name LIKE \\\'%JOKO BANDUNG%\\\' OR name LIKE \\\'%NANIK MAD%\\\'\').then(r => console.log(r[0])).catch(console.error).finally(()=>process.exit(0))"', { cwd: '/var/www/billing' }))
    .then(result => {
        console.log('STDOUT:\n' + result.stdout);
        console.log('STDERR:\n' + result.stderr);
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
