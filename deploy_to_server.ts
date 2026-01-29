
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function deploy() {
    console.log('Connecting to server 192.168.239.154...');
    try {
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi',
            port: 22
        });
        console.log('✅ Connected!');

        // 1. Find the directory
        console.log('Finding project directory...');
        // Try common paths
        const searchPaths = ['/var/www/billing', '/home/adi/billing', '/var/www/html/billing'];
        let projectPath = '';

        for (const p of searchPaths) {
            const check = await ssh.execCommand(`[ -d "${p}" ] && echo "exists"`);
            if (check.stdout.trim() === 'exists') {
                projectPath = p;
                break;
            }
        }

        if (!projectPath) {
            console.error('❌ Could not find billing directory in common paths (/var/www/billing, /home/adi/billing)');
            process.exit(1);
        }

        console.log(`📂 Project found at: ${projectPath}`);

        // 2. Git Pull
        console.log('🚀 Pulling latest changes...');
        const gitPull = await ssh.execCommand('git pull origin main', { cwd: projectPath });
        console.log(gitPull.stdout);
        console.error(gitPull.stderr);

        // 3. Build
        console.log('🛠️ Building project...');
        const build = await ssh.execCommand('npm run build', { cwd: projectPath });
        console.log(build.stdout);
        console.error(build.stderr);

        // 4. Restart PM2
        console.log('🔄 Restarting PM2...');
        const pm2 = await ssh.execCommand('pm2 reload billing-app || pm2 restart all', { cwd: projectPath });
        console.log(pm2.stdout);
        console.error(pm2.stderr);

        console.log('✅ Deployment Complete!');
        ssh.dispose();

    } catch (err) {
        console.error('❌ Deployment Failed:', err);
        ssh.dispose();
    }
}

deploy();
