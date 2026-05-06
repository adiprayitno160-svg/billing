const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

async function deploy() {
    const ssh = new NodeSSH();
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' });

        // Upload the compiled file
        const localFile = path.join(__dirname, 'dist', 'controllers', 'customerController.js');
        const remoteFile = '/var/www/billing/dist/controllers/customerController.js';
        
        console.log('--- UPLOADING customerController.js ---');
        await ssh.putFile(localFile, remoteFile);
        console.log('Upload complete!');

        // Also upload map file if exists
        const mapFile = localFile + '.map';
        if (fs.existsSync(mapFile)) {
            await ssh.putFile(mapFile, remoteFile + '.map');
            console.log('Map file uploaded!');
        }

        // Restart PM2
        console.log('\n--- RESTARTING billing-app ---');
        const restart = await ssh.execCommand('pm2 restart billing-app');
        console.log(restart.stdout);

        // Wait for startup
        await new Promise(r => setTimeout(r, 8000));

        // Check status
        console.log('\n--- STATUS CHECK ---');
        const logs = await ssh.execCommand('tail -5 /home/adi/.pm2/logs/billing-app-out.log');
        console.log(logs.stdout);

        // Verify the fix is in place
        console.log('\n--- VERIFY FIX ---');
        const verify = await ssh.execCommand('grep "pppoe_package_name" /var/www/billing/dist/controllers/customerController.js | head -3');
        console.log(verify.stdout || '(FIX NOT FOUND!)');

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        ssh.dispose();
    }
}

deploy();
