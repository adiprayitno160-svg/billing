const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
(async () => {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log("--- Checking unified_notifications_queue columns ---");
        const dbResult = await ssh.execCommand('echo "adi" | sudo -S mysql -e "DESCRIBE unified_notifications_queue;" billing');
        console.log(dbResult.stdout);
        if (dbResult.stderr) console.error(dbResult.stderr);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
})();
