const { NodeSSH } = require('node-ssh');
const path = require('path');

async function uploadAndRun() {
    const ssh = new NodeSSH();
    try {
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi'
        });
        console.log('Connected to live server');

        const localFile = path.join(__dirname, 'live_yudi_cleanup.js');
        const remoteFile = '/var/www/billing/live_yudi_cleanup.js';

        await ssh.putFile(localFile, remoteFile);
        console.log('Uploaded live_yudi_cleanup.js');

        const result = await ssh.execCommand('node live_yudi_cleanup.js', { cwd: '/var/www/billing' });
        
        console.log(result.stdout);
        if (result.stderr) console.error('STDERR:', result.stderr);
        
        // Cleanup remote file for security
        await ssh.execCommand('rm live_yudi_cleanup.js', { cwd: '/var/www/billing' });
        console.log('Cleaned up remote script file.');

        ssh.dispose();
    } catch(e) {
        console.error('Error:', e.message);
    }
}
uploadAndRun();
