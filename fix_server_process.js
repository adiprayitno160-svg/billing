const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fixProcess() {
    try {
        console.log('Connecting...');
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi',
            port: 22
        });
        console.log('✅ Connected');

        // 1. Check PID of process on 3001
        console.log('\n--- Checking 3001 ---');
        const netstat = await ssh.execCommand('echo "adi" | sudo -S netstat -tulpn | grep 3001');
        console.log(netstat.stdout);
        const pid = netstat.stdout.split('/')[0].trim().split(' ').pop();

        if (pid && !isNaN(pid)) {
            console.log(`FOUND LOCKED PROCESS: ${pid}. Killing it...`);
            await ssh.execCommand(`echo "adi" | sudo -S kill -9 ${pid}`);
            console.log('Killed.');
        } else {
            console.log('No process found on 3001 (or netstat output parse failed).');
        }

        // 2. Kill all node processes just in case
        console.log('Killing all node processes...');
        await ssh.execCommand('echo "adi" | sudo -S killall node');

        // 3. Restart PM2 as user 'adi'
        console.log('Starting PM2 as user adi...');
        // We assume pm2 is in path or we use full path. Node is usually /usr/bin/node
        // We'll try restart first, then start ecosystem
        const restart = await ssh.execCommand('pm2 restart billing-app', { cwd: '/var/www/billing' });
        console.log(restart.stdout);

        if (restart.stderr) {
            console.log('Restart failed/warn, trying start...');
            await ssh.execCommand('pm2 start ecosystem.config.js --env production', { cwd: '/var/www/billing' });
        }

        console.log('✅ Done. Please wait 10s and check.');
        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
}

fixProcess();
