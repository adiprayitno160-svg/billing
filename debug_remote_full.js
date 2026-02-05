const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function debugRemote() {
    try {
        console.log('Connecting...');
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi',
            port: 22
        });
        console.log('✅ Connected');

        // 1. Check current directory of the running process
        console.log('\n--- PM2 Process Info ---');
        const pm2Env = await ssh.execCommand('pm2 describe billing-app');
        console.log(pm2Env.stdout);

        // 2. Check content of sidebar.ejs for "v2.5"
        console.log('\n--- Checking for "System (v2.5)" string in sidebar.ejs ---');
        const grepVersion = await ssh.execCommand('grep "v2.5" /var/www/billing/views/partials/sidebar.ejs');
        console.log('Grep Output:', grepVersion.stdout || '(NOT FOUND)');

        // 3. Check for "Monitoring" menu
        console.log('\n--- Checking for "Monitoring" menu string in sidebar.ejs ---');
        const grepMenu = await ssh.execCommand('grep "Monitoring" /var/www/billing/views/partials/sidebar.ejs');
        console.log('Grep Output count:', (grepMenu.stdout.match(/Monitoring/g) || []).length);

        // 4. List the views directory to make sure it's accessible
        console.log('\n--- Listing views/partials dir ---');
        const lp = await ssh.execCommand('ls -la /var/www/billing/views/partials/');
        console.log(lp.stdout);

        ssh.dispose();
    } catch (err) {
        console.error('Error:', err);
    }
}

debugRemote();
