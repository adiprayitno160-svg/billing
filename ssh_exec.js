const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function testConnection() {
    try {
        console.log('🔄 Mencoba menghubungkan ke 192.168.239.154 as adi...');

        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi', // Menggunakan password yang Anda berikan
            port: 22
        });

        console.log('✅ Berhasil terhubung ke SSH!');

        console.log('\n--- Informasi Server ---');
        const result = await ssh.execCommand('lsb_release -a && uname -a');
        console.log(result.stdout);

        console.log('\n--- Status PM2 (Aplikasi) ---');
        const pm2Result = await ssh.execCommand('pm2 list');
        console.log(pm2Result.stdout);

        ssh.dispose();
    } catch (err) {
        console.error('❌ Gagal terhubung:', err.message);
    }
}

testConnection();
