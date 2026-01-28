const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function runUpdate() {
    try {
        console.log('🚀 Menghubungkan ke 192.168.239.154 (User: adi)...');

        await ssh.connect({
            host: '192.168.239.154',
            username: 'adi',
            password: 'adi',
            port: 22
        });

        console.log('✅ Terhubung!');

        const remoteCommands = [
            'echo "--> 1. Masuk ke direktori project..."',
            'cd /var/www/billing || exit 1',

            'echo "--> 2. Mengambil kredensial DB dari .env..."',
            'DB_USER=$(grep "^DB_USER" .env | cut -d "=" -f2 | tr -d "\\r")',
            'DB_PASS=$(grep "^DB_PASSWORD" .env | cut -d "=" -f2 | tr -d "\\r")',

            'echo "--> 3. Menjalankan SQL Fix..."',
            'SQL_QUERY="USE billing; ALTER TABLE manual_payment_verifications ADD COLUMN IF NOT EXISTS verified_by INT NULL; ALTER TABLE manual_payment_verifications ADD COLUMN IF NOT EXISTS verified_at DATETIME NULL; ALTER TABLE manual_payment_verifications ADD COLUMN IF NOT EXISTS invoice_id INT NULL; ALTER TABLE manual_payment_verifications ADD COLUMN IF NOT EXISTS notes TEXT NULL; CREATE INDEX IF NOT EXISTS idx_verified_by ON manual_payment_verifications(verified_by); ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at DATETIME NULL;"',

            'if [ ! -z "$DB_PASS" ]; then mysql -u"$DB_USER" -p"$DB_PASS" -e "$SQL_QUERY"; else mysql -u"$DB_USER" -e "$SQL_QUERY"; fi',

            'echo "--> 4. Restarting Application (PM2)..."',
            'pm2 restart billing-app --update-env || pm2 start ecosystem.config.js --env production',

            'echo "✅ SEMUA PROSES SELESAI!"'
        ];

        // Menjalankan perintah satu per satu agar log terlihat jelas
        for (const cmd of remoteCommands) {
            const result = await ssh.execCommand(cmd, { cwd: '/var/www/billing' });
            if (result.stdout) console.log(result.stdout);
            if (result.stderr) console.error('⚠️ Detil:', result.stderr);
        }

        ssh.dispose();
    } catch (err) {
        console.error('❌ Error saat update:', err.message);
        process.exit(1);
    }
}

runUpdate();
