const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log("--- Checking PM2 Logs for WhatsApp Status ---");
        const logsResult = await ssh.execCommand('pm2 logs billing-app --lines 100 --raw');
        console.log(logsResult.stdout || logsResult.stderr);

        console.log("\n--- Checking Queue Status again ---");
        const dbResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "SELECT status, COUNT(*) FROM unified_notifications_queue GROUP BY status;" billing');
        console.log(dbResult.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
