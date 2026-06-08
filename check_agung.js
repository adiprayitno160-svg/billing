const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => {
        const cmd = `node -e "
        require('dotenv').config();
        const { databasePool } = require('./dist/db/pool');
        
        async function run() {
            try {
                const [cust] = await databasePool.query(\`
                    SELECT id, name, status, connection_type, is_isolated 
                    FROM customers 
                    WHERE name LIKE '%agung%' OR name LIKE '%besole%'
                \`);
                console.log('Customers found:', cust);
            } catch(e) {
                console.error(e);
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
        process.exit(0);
    })
    .catch(console.error);
