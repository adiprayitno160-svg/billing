const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function verifyIntegrity() {
    try {
        console.log('Connecting...');
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi',
            port: 22
        });
        console.log('✅ Connected');

        // 1. Check content of sidebar.ejs on DISK
        console.log('\n--- HEAD of sidebar.ejs (Version Check) ---');
        // grep context to see where Monitoring is
        const grepMonitor = await ssh.execCommand('grep -B 5 -A 5 "Monitoring" /var/www/billing/views/partials/sidebar.ejs');
        console.log('--- Grep "Monitoring" location ---');
        console.log(grepMonitor.stdout);

        console.log('\n--- Grep "Network Map" ---');
        const grepMap = await ssh.execCommand('grep "Network Map" /var/www/billing/views/partials/sidebar.ejs');
        console.log(grepMap.stdout);

        // 2. Check process on 3001 again
        console.log('\n--- Port 3001 Owner ---');
        const netstat = await ssh.execCommand('echo "adi" | sudo -S netstat -tulpn | grep 3001');
        console.log(netstat.stdout);

        // 3. Check uptime of PM2 process
        console.log('\n--- PM2 List ---');
        const pm2 = await ssh.execCommand('pm2 list');
        console.log(pm2.stdout);

        ssh.dispose();
    } catch (e) { console.error(e); }
}
verifyIntegrity();
