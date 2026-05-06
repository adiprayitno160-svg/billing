import { Client } from 'ssh2';

const config = {
    host: '192.168.239.154',
    port: 22,
    username: 'adi',
    password: 'adi'
};

async function getRemoteEnv() {
    const conn = new Client();
    conn.on('ready', () => {
        console.log('SSH Ready');
        // Command to read .env using sudo
        const command = "echo 'adi' | sudo -S cat /var/www/billing/.env";
        conn.exec(command, (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                conn.end();
            }).on('data', (data) => {
                console.log('STDOUT: ' + data);
            }).stderr.on('data', (data) => {
                // Ignore sudo warning
                if (!String(data).includes('[sudo] password for adi')) {
                    console.log('STDERR: ' + data);
                }
            });
        });
    }).connect(config);
}

getRemoteEnv().catch(console.error);
