const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function debug() {
    try {
        console.log('Connecting...');
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });

        console.log('Stopping PM2...');
        await ssh.execCommand('pm2 stop billing-app || true');

        console.log('Running App MANUALLY (Foreground)...');
        // Kita jalankan server.js langsung dan lihat errornya
        const result = await ssh.execCommand('node dist/server.js', {
            cwd: '/var/www/billing',
            onStdout: (chunk) => console.log('STDOUT:', chunk.toString()),
            onStderr: (chunk) => console.log('STDERR:', chunk.toString()),
        });

        console.log('Process exited.');
        ssh.dispose();
    } catch (err) {
        console.error('Error:', err.message);
    }
}
debug();
