const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function start() {
    try {
        await ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi', port: 22 });
        const envResult = await ssh.execCommand('cat /var/www/billing/.env');
        const env = envResult.stdout;

        const getVal = (keys) => {
            for (const key of keys) {
                const match = env.match(new RegExp(`^${key}=(.*)`, 'm'));
                if (match) return match[1].trim().replace(/['"]/g, '');
            }
            return null;
        };

        const dbUser = getVal(['DB_USER', 'DB_USERNAME']);
        const dbPass = getVal(['DB_PASSWORD', 'DB_PASS']);
        const dbName = getVal(['DB_DATABASE', 'DB_NAME', 'DB_DB']) || 'billing';

        const sqlCommands = [
            "ALTER TABLE manual_payment_verifications ADD COLUMN verified_by INT NULL",
            "ALTER TABLE manual_payment_verifications ADD COLUMN verified_at DATETIME NULL",
            "ALTER TABLE manual_payment_verifications ADD COLUMN invoice_id INT NULL",
            "ALTER TABLE manual_payment_verifications ADD COLUMN notes TEXT NULL",
            "CREATE INDEX idx_verified_by ON manual_payment_verifications(verified_by)",
            "ALTER TABLE invoices ADD COLUMN paid_at DATETIME NULL"
        ];

        console.log('🛠️ Executing SQL commands one by one...');
        for (const sql of sqlCommands) {
            const mysqlCmd = `mysql -u"${dbUser}" -p"${dbPass}" "${dbName}" -e "${sql}"`;
            const res = await ssh.execCommand(mysqlCmd);
            if (res.stderr && !res.stderr.includes('Duplicate column')) {
                console.log(`⚠️ Note for [${sql.substring(0, 20)}...]:`, res.stderr.trim());
            } else {
                console.log(`✅ Success or already exists: ${sql.substring(0, 30)}...`);
            }
        }

        await ssh.execCommand('pm2 restart billing-app', { cwd: '/var/www/billing' });
        console.log('🚀 Application Restarted!');
        ssh.dispose();
    } catch (err) {
        console.error('❌ ERROR:', err.message);
    }
}
start();
