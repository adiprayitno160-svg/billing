const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log("--- Checking pending notifications with scheduled_for ---");
        const dbResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "SELECT id, customer_id, status, scheduled_for, created_at, NOW() as current_time FROM unified_notifications_queue WHERE status = \'pending\' LIMIT 10;" billing');
        console.log(dbResult.stdout);
        if (dbResult.stderr) console.error(dbResult.stderr);

        console.log("\n--- Checking all statuses count ---");
        const countResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "SELECT status, COUNT(*) as cnt FROM unified_notifications_queue GROUP BY status;" billing');
        console.log(countResult.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
