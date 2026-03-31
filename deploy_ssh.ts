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
        console.log('CONNECTED successfully!');

        // 1. Identify Remote Directory
        console.log('Identifying remote directory...');
        let remotePath = '/var/www/billing';
        const checkLinux = await ssh.execCommand('ls -d /var/www/billing');
        if (checkLinux.code !== 0) {
            console.log('/var/www/billing not found, checking windows path...');
            const checkWin = await ssh.execCommand('dir /b c:\\laragon\\www\\billing');
            if (checkWin.code === 0) {
                remotePath = 'c:\\laragon\\www\\billing';
            } else {
                console.error('Remote directory not found! Trying default /var/www/billing');
            }
        }
        console.log('Using path:', remotePath);

        // 2. Perform Git Pull (Cleanly)
        console.log('Syncing code from GitHub...');
        const gitFetch = await ssh.execCommand('git fetch --all', { cwd: remotePath });
        console.log('Fetch:', gitFetch.stdout || gitFetch.stderr);

        const gitReset = await ssh.execCommand('git reset --hard origin/main', { cwd: remotePath });
        console.log('Reset:', gitReset.stdout || gitReset.stderr);

        // 3. Restart Service
        console.log('Restarting application...');
        const pm2Restart = await ssh.execCommand('pm2 restart billing || pm2 restart all', { cwd: remotePath });
        console.log('PM2:', pm2Restart.stdout || pm2Restart.stderr);

        console.log('DEPLOYMENT FINISHED SUCCESSFULLY!');
        ssh.dispose();
    } catch (err: any) {
        console.error('CRITICAL ERROR DURING DEPLOY:', err.message);
        process.exit(1);
    }
}

deploy();
