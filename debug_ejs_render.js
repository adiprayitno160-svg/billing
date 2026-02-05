const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkEjsCompilation() {
    try {
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi',
            port: 22
        });

        console.log('--- Checking for EJS conditional logic ---');
        // Let's see if there is any condition wrapping the monitoring menu
        const content = await ssh.execCommand('grep -B 5 -A 20 "Monitoring Section" /var/www/billing/views/partials/sidebar.ejs');
        console.log(content.stdout);

        console.log('\n--- Checking for accidental hidden class or style ---');
        const style = await ssh.execCommand('grep -A 5 "class=\"menu-group\"" /var/www/billing/views/partials/sidebar.ejs | grep "Monitoring" -B 5');
        console.log(style.stdout);

        ssh.dispose();
    } catch (e) { console.error(e); }
}
checkEjsCompilation();
