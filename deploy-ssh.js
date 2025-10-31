const { NodeSSH } = require('node-ssh');
const readline = require('readline');

// Konfigurasi SSH (bisa diubah atau diambil dari environment variables)
const SSH_CONFIG = {
    host: process.env.SSH_HOST || '192.168.239.126',
    username: 'adi',
    password: 'adi',
    port: parseInt(process.env.SSH_PORT || '22'),
    readyTimeout: 30000,
};

// Path aplikasi di server production
const APP_PATH = process.env.APP_PATH || '/opt/billing';

const ssh = new NodeSSH();

async function deploy() {
    console.log('🚀 Starting deployment via SSH...\n');
    console.log(`📡 Connecting to ${SSH_CONFIG.username}@${SSH_CONFIG.host}:${SSH_CONFIG.port}...`);

    try {
        // 1. Connect to server
        await ssh.connect(SSH_CONFIG);
        console.log('✅ Connected to server successfully!\n');

        // 2. Check current directory and Git status
        console.log('📂 Checking Git status...');
        const gitStatus = await ssh.execCommand('cd ' + APP_PATH + ' && git status --short', { cwd: APP_PATH });
        if (gitStatus.stdout) {
            console.log('📝 Current changes:');
            console.log(gitStatus.stdout);
        } else {
            console.log('✅ Working directory is clean');
        }
        console.log('');

        // 3. Pull latest changes
        console.log('📥 Pulling latest changes from GitHub...');
        const pullResult = await ssh.execCommand('git pull origin main', { cwd: APP_PATH });
        if (pullResult.code === 0) {
            console.log('✅ Git pull successful');
            console.log(pullResult.stdout);
        } else {
            console.error('❌ Git pull failed:');
            console.error(pullResult.stderr);
            throw new Error('Git pull failed');
        }
        console.log('');

        // 4. Install dependencies (if package.json changed)
        console.log('📦 Installing dependencies (if needed)...');
        const installResult = await ssh.execCommand('npm install', { cwd: APP_PATH });
        if (installResult.code === 0) {
            console.log('✅ Dependencies installed');
        } else {
            console.warn('⚠️  npm install had warnings (continuing anyway):');
            console.warn(installResult.stderr);
        }
        console.log('');

        // 5. Build application
        console.log('🔨 Building application...');
        const buildResult = await ssh.execCommand('npm run build', { cwd: APP_PATH });
        if (buildResult.code === 0) {
            console.log('✅ Build successful');
            if (buildResult.stdout) console.log(buildResult.stdout);
        } else {
            console.error('❌ Build failed:');
            console.error(buildResult.stderr);
            throw new Error('Build failed');
        }
        console.log('');

        // 6. Build CSS (optional, but recommended)
        console.log('🎨 Building CSS...');
        const cssResult = await ssh.execCommand('npm run css:build', { cwd: APP_PATH });
        if (cssResult.code === 0) {
            console.log('✅ CSS build successful');
        } else {
            console.warn('⚠️  CSS build had warnings (continuing anyway):');
            console.warn(cssResult.stderr);
        }
        console.log('');

        // 7. Reload PM2 application (zero downtime)
        console.log('🔄 Reloading PM2 application...');
        const reloadResult = await ssh.execCommand('pm2 reload billing-app', { cwd: APP_PATH });
        if (reloadResult.code === 0) {
            console.log('✅ PM2 reload successful');
            console.log(reloadResult.stdout);
        } else {
            console.error('❌ PM2 reload failed:');
            console.error(reloadResult.stderr);
            throw new Error('PM2 reload failed');
        }
        console.log('');

        // 8. Check PM2 status
        console.log('📊 Checking PM2 status...');
        const statusResult = await ssh.execCommand('pm2 list', { cwd: APP_PATH });
        if (statusResult.code === 0) {
            console.log(statusResult.stdout);
        }
        console.log('');

        console.log('🎉 Deployment completed successfully!');
        console.log(`🌐 Application should be available at: http://${SSH_CONFIG.host}:3000`);

    } catch (error) {
        console.error('\n❌ Deployment failed:');
        console.error(error.message);
        if (error.stderr) console.error(error.stderr);
        process.exit(1);
    } finally {
        ssh.dispose();
        console.log('\n👋 SSH connection closed');
    }
}

// Run deployment
deploy().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

