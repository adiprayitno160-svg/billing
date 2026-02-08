const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log("--- Adding updated_at column to unified_notifications_queue ---");
        const dbResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "ALTER TABLE unified_notifications_queue ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;" billing');
        console.log(dbResult.stdout);
        if (dbResult.stderr) console.error(dbResult.stderr);

        console.log("--- Verifying column added ---");
        const verifyResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "DESCRIBE unified_notifications_queue;" billing');
        console.log(verifyResult.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
