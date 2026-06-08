const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => {
        const cmd = `node -e "
        require('dotenv').config();
        const { databasePool } = require('./dist/db/pool');
        
        async function run() {
            try {
                // Check offline PPPoE
                const [offlinePppoe] = await databasePool.query(\`
                    SELECT c.id, c.name, cl.status, cl.timestamp
                    FROM customers c
                    JOIN connection_logs cl ON c.id = cl.customer_id
                    WHERE c.status = 'active' AND cl.status = 'offline'
                    ORDER BY cl.timestamp DESC LIMIT 5
                \`);
                console.log('Recent offline PPPoE logs:', offlinePppoe);
                
                // Check Static IP offline
                const [offlineStatic] = await databasePool.query(\`
                    SELECT c.id, c.name, sips.status, sips.last_check
                    FROM customers c
                    JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                    WHERE c.status = 'active' AND sips.status = 'offline'
                \`);
                console.log('Offline Static IPs:', offlineStatic);
            } catch(e) {
                console.error('DB ERROR:', e.message);
            } finally {
                process.exit(0);
            }
        }
        run();
        "`;
        return ssh.execCommand(cmd, { cwd: '/var/www/billing' });
    })
    .then(result => {
        console.log('STDOUT:\n' + result.stdout);
        console.log('STDERR:\n' + result.stderr);
        process.exit(0);
    })
    .catch(console.error);
