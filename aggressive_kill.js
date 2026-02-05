const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function aggressiveKill() {
    try {
        console.log('Connecting...');
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi',
            port: 22
        });
        console.log('✅ Connected');

        // 1. Find PIDs of billing-app
        console.log('Finding rogue processes...');
        // We grep for the script path to avoid killing genieacs
        const ps = await ssh.execCommand('ps -ef | grep "dist/server.js" | grep -v grep');
        console.log(ps.stdout);

        const lines = ps.stdout.split('\n');
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 1) {
                const pid = parts[1];
                console.log(`Killing PID ${pid}...`);
                const kill = await ssh.execCommand(`echo "adi" | sudo -S kill -9 ${pid}`);
                if (kill.stdout) console.log('Kill out:', kill.stdout);
                if (kill.stderr) console.log('Kill err:', kill.stderr);
            }
        }

        // 2. Verify
        console.log('Verifying...');
        const ps2 = await ssh.execCommand('ps -ef | grep "dist/server.js" | grep -v grep');
        if (ps2.stdout.trim().length > 0) {
            console.log('⚠️ Some processes survived:', ps2.stdout);
        } else {
            console.log('✅ All billing processes killed.');
        }

        // 3. Restart PM2 as adi
        console.log('Starting PM2...');
        await ssh.execCommand('pm2 restart billing-app || pm2 start ecosystem.config.js --env production', { cwd: '/var/www/billing' });
        console.log('PM2 Retarted.');

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
}

aggressiveKill();
