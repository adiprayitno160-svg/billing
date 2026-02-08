const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function diagnose() {
    try {
        console.log('🔄 Connecting to 192.168.239.154...');

        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi',
            port: 22
        });

        console.log('✅ Connected!');

        console.log('\n--- PM2 Status ---');
        const pm2Status = await ssh.execCommand('pm2 status');
        console.log(pm2Status.stdout);

        console.log('\n--- Root PM2 Status ---');
        const rootPm2 = await ssh.execCommand('echo "adi" | sudo -S pm2 status');
        console.log(rootPm2.stdout || rootPm2.stderr);

        console.log('\n--- Systemd Services ---');
        const services = await ssh.execCommand('echo "adi" | sudo -S systemctl list-units --type=service | grep billing');
        console.log(services.stdout || services.stderr);

        console.log('\n--- Full Process List (Node) ---');
        const psNode = await ssh.execCommand('ps aux | grep node');
        console.log(psNode.stdout);

        console.log('\n--- Logs Directory Permissions ---');
        const lsLogs = await ssh.execCommand('ls -la /var/www/billing/logs');
        console.log(lsLogs.stdout);

        console.log('\n--- Current User ---');
        const whoami = await ssh.execCommand('whoami');
        console.log(whoami.stdout);

        console.log('\n--- PM2 Describe ---');
        const describe = await ssh.execCommand('pm2 describe 0');
        console.log(describe.stdout);

        console.log('\n--- Checking Disk Space ---');
        const df = await ssh.execCommand('df -h /');
        console.log(df.stdout);

        console.log('\n--- Checking Memory ---');
        const free = await ssh.execCommand('free -m');
        console.log(free.stdout);

        ssh.dispose();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

diagnose();
