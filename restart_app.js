
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

        console.log('🔄 Restarting billing-app via PM2...');
        // Using restart instead of reload for a complete fresh start
        const result = await ssh.execCommand('pm2 restart billing-app');

        console.log('Output:', result.stdout);
        if (result.stderr) console.error('Error Output:', result.stderr);

        console.log('✅ Application restarted successfully.');
        ssh.dispose();
    } catch (e) {
        console.error('Failed:', e);
    }
})();
