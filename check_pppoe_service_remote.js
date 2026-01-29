
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

(async () => {
    try {
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi'
        });

        const res = await ssh.execCommand('grep -n "beginTransaction" /var/www/billing/src/services/pppoeService.ts', { cwd: '/var/www/billing' });
        console.log('Lines with beginTransaction:\n', res.stdout);

        const res2 = await ssh.execCommand('sed -n "360,600p" /var/www/billing/src/services/pppoeService.ts', { cwd: '/var/www/billing' });
        console.log('--- Code block around createPackage (lines 360-600) ---');
        console.log(res2.stdout);

        ssh.dispose();
    } catch (e) { console.error(e); }
})();
