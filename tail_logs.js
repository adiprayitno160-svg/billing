const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log("--- Checking Recent Logs (Last 100 lines) ---");
        const logsResult = await ssh.execCommand('tail -n 100 /var/www/billing/logs/pm2-out-0.log');
        console.log(logsResult.stdout);

        console.log("\n--- Checking WhatsApp Status via Log Errors ---");
        const waErrors = await ssh.execCommand('grep -i "error" /var/www/billing/logs/pm2-error-0.log | tail -n 20');
        console.log(waErrors.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
