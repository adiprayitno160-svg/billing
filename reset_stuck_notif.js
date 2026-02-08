const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log("--- Resetting stuck 'processing' notifications to 'pending' ---");
        const resetResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "UPDATE unified_notifications_queue SET status = \'pending\', error_message = \'Reset by admin\' WHERE status = \'processing\';" billing');
        console.log(resetResult.stdout);
        if (resetResult.stderr) console.error(resetResult.stderr);

        console.log("\n--- Checking all statuses count after reset ---");
        const countResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "SELECT status, COUNT(*) as cnt FROM unified_notifications_queue GROUP BY status;" billing');
        console.log(countResult.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
