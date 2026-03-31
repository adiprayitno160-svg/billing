import { NodeSSH } from 'node-ssh';

async function deploy() {
    const ssh = new NodeSSH();
    try {
        console.log('Connecting to SSH 192.168.239.154 as adi...');
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi'
        });
        console.log('CONNECTED!');

        const remotePath = '/var/www/billing';
        
        // 1. Git pull
        console.log('PULLING CODE...');
        await ssh.execCommand('git fetch --all && git reset --hard origin/main', { cwd: remotePath });
        
        // 2. Build
        console.log('BUILDING APP (npm run build)...');
        const build = await ssh.execCommand('npm run build', { cwd: remotePath });
        console.log('Build Result:', build.stdout || 'Done');
        if (build.stderr) console.error('Build Error:', build.stderr);

        // 3. Restart
        console.log('RESTARTING PM2...');
        const restart = await ssh.execCommand('pm2 restart all', { cwd: remotePath });
        console.log('PM2:', restart.stdout);

        // 4. Verify Port
        console.log('VERIFYING PORT 3002...');
        const port = await ssh.execCommand('netstat -tpln | grep 3002', { cwd: remotePath });
        console.log('Port 3002:', port.stdout || 'STILL NOT LISTENING');

        ssh.dispose();
    } catch (err: any) {
        console.error('ERROR:', err.message);
    }
}

deploy();
