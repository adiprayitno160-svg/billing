const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log("--- Checking UnifiedNotificationService Logs ---");
        const logsResult = await ssh.execCommand('grep "UnifiedNotification" /var/www/billing/logs/pm2-out-0.log | tail -n 50');
        console.log(logsResult.stdout);

        console.log("\n--- Checking WhatsApp Status via Logs ---");
        const waLogs = await ssh.execCommand('grep "WhatsApp" /var/www/billing/logs/pm2-out-0.log | tail -n 20');
        console.log(waLogs.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
