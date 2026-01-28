const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const path = require('path');

async function runUpdate() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        // 1. Upload file SQL
        await ssh.putFile(path.join(__dirname, 'fix_schema.sql'), '/var/www/billing/fix_schema.sql');

        // 2. Jalankan perintah MySQL menggunakan file tersebut
        const cmd = "cd /var/www/billing && " +
            "U=$(grep '^DB_USER' .env | tail -n 1 | cut -d= -f2 | tr -d '\r\n \"\\'') && " +
            "P=$(grep '^DB_PASSWORD' .env | tail -n 1 | cut -d= -f2 | tr -d '\r\n \"\\'') && " +
            "mysql -u$U -p$P < fix_schema.sql";

        console.log('🏃 Executing SQL File on Server...');
        const result = await ssh.execCommand(cmd);
        console.log('Result:', result.stdout || 'Success (No output)');
        if (result.stderr) console.log('Log:', result.stderr);

        await ssh.execCommand('pm2 restart billing-app', { cwd: '/var/www/billing' });
        console.log('✅ App Restarted!');
        ssh.dispose();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}
runUpdate();
