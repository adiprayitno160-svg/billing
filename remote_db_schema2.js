const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => {
        const cmd = `node -e "
        require('dotenv').config();
        const { databasePool } = require('./dist/db/pool');
        
        async function run() {
            try {
                const [cols1] = await databasePool.query('DESCRIBE sla_incidents');
                console.log('sla_incidents:', cols1.map(c => c.Field).join(', '));
                
                const [cols2] = await databasePool.query('DESCRIBE tickets');
                console.log('tickets:', cols2.map(c => c.Field).join(', '));
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
