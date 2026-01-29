
const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

(async () => {
    try {
        console.log('Connecting...');
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi'
        });

        const local = path.resolve(__dirname, 'debug_full_citra.js');
        const remote = '/var/www/billing/debug_full_citra.js';

        await ssh.putFile(local, remote);
        const res = await ssh.execCommand(`node ${remote}`, { cwd: '/var/www/billing' });

        console.log(res.stdout);
        if (res.stderr) console.error(res.stderr);

        await ssh.execCommand(`rm ${remote}`);
        ssh.dispose();
    } catch (e) { console.error(e); }
})();
