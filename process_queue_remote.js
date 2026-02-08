const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log("--- 1. Resetting Failed & Skipped to Pending ---");
        const resetResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "UPDATE unified_notifications_queue SET status = \'pending\', retry_count = 0, error_message = NULL WHERE status IN (\'failed\', \'skipped\');" billing');
        console.log(resetResult.stdout || resetResult.stderr);

        console.log("\n--- 2. Current Status After Reset ---");
        const statusResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "SELECT status, COUNT(*) FROM unified_notifications_queue GROUP BY status;" billing');
        console.log(statusResult.stdout);

        console.log("\n--- 3. Triggering PM2 Process (Just in case) ---");
        // No direct way to call the API from here easily without curl, but let's check logs to see if scheduler starts
        const logsResult = await ssh.execCommand('pm2 logs billing-app --lines 20 --raw --noprefix');
        console.log(logsResult.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
