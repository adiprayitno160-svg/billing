
const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

(async () => {
    try {
        console.log('Connecting to Server 192.168.239.154...');
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi'
        });
        console.log('✅ Connected.');

        const local = path.resolve(__dirname, 'fix_citra_db.js');
        const remote = '/var/www/billing/fix_citra_db.js';

        console.log('Uploading cleanup script...');
        await ssh.putFile(local, remote);

        console.log('Executing cleanup on server...');
        const res = await ssh.execCommand(`node ${remote}`, { cwd: '/var/www/billing' });

        console.log('\n--- SERVER OUTPUT ---');
        console.log(res.stdout);
        if (res.stderr) console.error('STDERR:', res.stderr);
        console.log('---------------------\n');

        // Cleanup
        await ssh.execCommand(`rm ${remote}`);
        ssh.dispose();

    } catch (e) {
        console.error('SSH Error:', e);
    }
})();
