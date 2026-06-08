const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({ host: '192.168.239.154', username: 'adi', password: 'adi' })
    .then(() => {
        const cmd = `node -e "
        require('dotenv').config();
        const { databasePool } = require('./dist/db/pool');
        
        async function run() {
            try {
                const [r1] = await databasePool.query('SELECT JSON_CONTAINS(\\'[1, 2, 3]\\', CAST(2 AS CHAR), \\'$\\') as res');
                console.log('CAST AS CHAR:', r1[0].res);
                
                // CAST AS JSON might not exist in old MySQL, but let's try
                try {
                    const [r2] = await databasePool.query('SELECT JSON_CONTAINS(\\'[1, 2, 3]\\', CAST(2 AS JSON), \\'$\\') as res');
                    console.log('CAST AS JSON:', r2[0].res);
                } catch(e) {
                    console.log('CAST AS JSON failed', e.message);
                }
                
                // Without cast
                try {
                    const [r3] = await databasePool.query('SELECT JSON_CONTAINS(\\'[1, 2, 3]\\', \\'2\\', \\'$\\') as res');
                    console.log('String Literal:', r3[0].res);
                } catch(e) {
                    console.log('String Literal failed', e.message);
                }
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
