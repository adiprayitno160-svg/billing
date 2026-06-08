const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const ssh = new NodeSSH();

async function deploy() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });
        console.log('Connected! Uploading files...');
        
        const files = [
            'src/services/monitoring/AdvancedMonitoringService.ts',
            'src/services/telegram/TelegramAdminService.ts'
        ];
        
        for (const file of files) {
            console.log(`Uploading ${file}...`);
            await ssh.putFile(`c:/laragon/www/billing/${file}`, `/var/www/billing/${file}`);
        }
        
        console.log('Building project...');
        const buildResult = await ssh.execCommand('npm run build', { cwd: '/var/www/billing' });
        console.log(buildResult.stdout);
        if (buildResult.stderr) console.error(buildResult.stderr);
        
        console.log('Restarting PM2...');
        const restartResult = await ssh.execCommand('pm2 restart billing', { cwd: '/var/www/billing' });
        console.log(restartResult.stdout);
        
        console.log('Deployment complete!');
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
deploy();
