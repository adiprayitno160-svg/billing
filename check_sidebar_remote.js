const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkSidebar() {
    try {
        console.log('🔄 Connecting to 192.168.239.154...');
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi', // Assuming 'adi' is the user
            password: 'adi',
            port: 22
        });
        console.log('✅ Connected!');

        // 1. Check file content
        console.log('\n--- Checking sidebar.ejs content (grep "Monitoring") ---');
        const grep = await ssh.execCommand('grep -C 5 "Monitoring" /var/www/billing/views/partials/sidebar.ejs');
        console.log('Grep Output:');
        console.log(grep.stdout || '(No output)');
        if (grep.stderr) console.error('Grep Error:', grep.stderr);

        // 2. Check file permissions
        console.log('\n--- Checking file permissions ---');
        const ls = await ssh.execCommand('ls -l /var/www/billing/views/partials/sidebar.ejs');
        console.log(ls.stdout);

        // 3. Force Reset Permission (just in case)
        console.log('\n--- Resetting Permissions ---');
        const chown = await ssh.execCommand('echo "adi" | sudo -S chown adi:adi /var/www/billing/views/partials/sidebar.ejs');
        console.log('Chown result:', chown.stdout, chown.stderr);

        ssh.dispose();
    } catch (err) {
        console.error('❌ Check failed:', err);
    }
}

checkSidebar();
