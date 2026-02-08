const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fix() {
    try {
        console.log('🔄 Connecting to 192.168.239.154...');

        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi',
            port: 22
        });

        console.log('✅ Connected!');

        console.log('\n--- Cleaning up Root PM2 ---');
        const rootStopCmd = 'echo "adi" | sudo -S pm2 delete billing-app || true';
        const rootStopResult = await ssh.execCommand(rootStopCmd);
        console.log('Root PM2 Delete:', rootStopResult.stdout || rootStopResult.stderr);

        console.log('\n--- Fixing Permissions ---');
        // Fix ownership of the entire billing directory
        const fixCmd = 'echo "adi" | sudo -S chown -R adi:adi /var/www/billing';
        const fixResult = await ssh.execCommand(fixCmd);
        console.log('Fix Ownership:', fixResult.stdout || fixResult.stderr);

        // Ensure logs directory is writable
        const chmodCmd = 'echo "adi" | sudo -S chmod -R 775 /var/www/billing/logs';
        const chmodResult = await ssh.execCommand(chmodCmd);
        console.log('Chmod logs:', chmodResult.stdout || chmodResult.stderr);

        console.log('\n--- Killing Zombie Processes ---');
        const killCmd = 'echo "adi" | sudo -S fuser -k 3001/tcp || true';
        const killResult = await ssh.execCommand(killCmd);
        console.log('Kill port 3001:', killResult.stdout || killResult.stderr);

        console.log('\n--- Restarting Application ---');
        const restartCmd = 'pm2 restart billing-app';
        const restartResult = await ssh.execCommand(restartCmd);
        console.log(restartResult.stdout);

        console.log('\n--- Checking Status ---');
        const statusResult = await ssh.execCommand('pm2 status');
        console.log(statusResult.stdout);

        ssh.dispose();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

fix();
