const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log("--- Checking Pending Notifications in DB ---");
        const dbResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "SELECT id, customer_id, status, scheduled_for, created_at, NOW() as current_time FROM unified_notifications_queue WHERE status = \'pending\';" billing');
        console.log(dbResult.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
