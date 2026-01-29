
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

(async () => {
    try {
        console.log('Connecting to server 192.168.239.154...');
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi'
        });
        console.log('✅ Connected.');

        console.log('🔄 Reloading PM2...');
        // Try reload specific app, fallback to restart all
        // Also save list to ensure resurrect works if needed, but here just reload is enough
        const result = await ssh.execCommand('pm2 reload billing-app || pm2 restart all');

        console.log('Output:', result.stdout);
        if (result.stderr) console.error('Error Output:', result.stderr);

        console.log('✅ PM2 Rebooted successfully.');
        ssh.dispose();
    } catch (e) {
        console.error('Failed:', e);
    }
})();
