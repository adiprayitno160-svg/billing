
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

(async () => {
    try {
        console.log('Connecting to server 192.168.239.154...');
        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi'
        });
        console.log('✅ Connected.');

        console.log('⚠️ REBOOTING SERVER NOW...');
        console.log('Command: echo "adi" | sudo -S reboot');

        // Execute reboot. Use start option to not wait for output? 
        // Or just catch the error when connection dies.
        ssh.execCommand('echo "adi" | sudo -S reboot', {
            stdin: 'adi\n' // Just in case
        }).catch(() => { });

        // Wait a split second then exit, assuming command went through
        await new Promise(r => setTimeout(r, 1000));

        console.log('✅ Reboot command sent. Server should be restarting.');
        console.log('Please wait 1-2 minutes before accessing the web interface.');
        ssh.dispose();
    } catch (e) {
        console.error('Connection failed:', e.message);
    }
})();
