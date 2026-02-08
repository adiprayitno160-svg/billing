const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log("--- Checking failed notifications ---");
        const dbResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "SELECT id, customer_id, notification_type, error_message FROM unified_notifications_queue WHERE status = \'failed\' ORDER BY id DESC LIMIT 10;" billing');
        console.log(dbResult.stdout);
        if (dbResult.stderr) console.error(dbResult.stderr);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
