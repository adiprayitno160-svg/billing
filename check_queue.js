const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });
        const result = await ssh.execCommand('echo "adi" | sudo -S mysql -e "SELECT status, COUNT(*) FROM unified_notifications_queue GROUP BY status;" billing');
        console.log("Current Notification Status:");
        console.log(result.stdout);
        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
