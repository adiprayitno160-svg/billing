const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

async function deploy() {
    const ssh = new NodeSSH();
    try {
        console.log('--- CONNECTING TO LIVE SERVER ---');
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi'
        });
        console.log('✅ Connected!');

        // Uploading core directories
        const dirs = ['dist', 'views', 'public'];
        for (const dir of dirs) {
            console.log(`🚀 Uploading ${dir} folder...`);
            await ssh.putDirectory(path.join(__dirname, dir), `/var/www/billing/${dir}`, {
                recursive: true,
                concurrency: 10
            });
        }

        console.log('🔄 Restarting Billing App...');
        await ssh.execCommand('pm2 reload billing-app', { cwd: '/var/www/billing' });

        // EXECUTING MASS PENDING SCRIPT
        console.log('📝 Initializing mass pending for March 2026...');
        const pendingScript = `
        const { InvoiceService } = require('./dist/services/billing/invoiceService');
        const { databasePool } = require('./dist/db/pool');

        async function run() {
            try {
                console.log('Starting mass pending logic for period 2026-03...');
                const result = await InvoiceService.massPendingInvoices('2026-03');
                console.log('SUCCESS:', result);
                process.exit(0);
            } catch (err) {
                console.error('ERROR:', err);
                process.exit(1);
            }
        }
        run();
        `;
        await ssh.execCommand(`echo "${pendingScript.replace(/"/g, '\\"')}" > trigger_mass_pending.js`, { cwd: '/var/www/billing' });
        const scriptResult = await ssh.execCommand('node trigger_mass_pending.js', { cwd: '/var/www/billing' });
        console.log('SCRIPT OUTPUT:', scriptResult.stdout || scriptResult.stderr);

        console.log('⚡ REBOOTING SERVER IN 5 SECONDS...');
        // Using nohup to allow disconnection before reboot
        await ssh.execCommand('sleep 5 && echo "adi" | sudo -S reboot', { cwd: '/var/www/billing' });

        console.log('✅ Deploy and Reboot initiated successfully.');
    } catch (err) {
        console.error('❌ Error during deploy:', err);
    } finally {
        ssh.dispose();
    }
}

deploy();
