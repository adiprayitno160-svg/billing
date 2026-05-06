import { Client } from 'ssh2';
import fs from 'fs';

const sshConfig = {
    host: '192.168.239.154',
    port: 22,
    username: 'adi',
    password: 'adi'
};

async function deployPatch() {
    const conn = new Client();
    const localFile = 'c:/laragon/www/billing/src/services/billing/isolationService.ts';
    const remoteFile = '/var/www/billing/src/services/billing/isolationService.ts';
    const content = fs.readFileSync(localFile, 'utf8');

    conn.on('ready', () => {
        console.log('SSH Ready');
        // Overwrite the file on the remote server
        conn.sftp((err, sftp) => {
            if (err) throw err;
            const stream = sftp.createWriteStream(remoteFile);
            stream.on('close', () => {
                console.log('File uploaded to remote server.');
                // Rebuild and restart the app on the remote server
                const buildCmd = "cd /var/www/billing && npm run build && pm2 restart billing-app";
                conn.exec(buildCmd, (err2, stream2) => {
                    if (err2) throw err2;
                    stream2.on('close', () => {
                        console.log('App rebuilt and restarted.');
                        conn.end();
                    }).on('data', (data) => {
                        console.log('STDOUT: ' + data);
                    }).stderr.on('data', (data) => {
                        console.log('STDERR: ' + data);
                    });
                });
            });
            stream.end(content);
        });
    }).connect(sshConfig);
}

deployPatch().catch(console.error);
