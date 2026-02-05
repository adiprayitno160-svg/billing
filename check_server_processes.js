const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkPortAndProcess() {
    try {
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi',
            port: 22
        });

        console.log('--- Port 3001 Owner ---');
        // Need sudo for netstat to see PID
        const netstat = await ssh.execCommand('echo "adi" | sudo -S netstat -tulpn | grep 3001');
        console.log(netstat.stdout);

        console.log('\n--- All Node Processes ---');
        const ps = await ssh.execCommand('ps -ef | grep node');
        console.log(ps.stdout);

        console.log('\n--- Check for dist/views existence ---');
        const checkDistViews = await ssh.execCommand('ls -ld /var/www/billing/dist/views');
        console.log(checkDistViews.stdout);
        console.log(checkDistViews.stderr);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
}
checkPortAndProcess();
