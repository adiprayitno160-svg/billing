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
    const content = fs.readFileSync(localFile, 'utf8');

    conn.on('ready', () => {
        console.log('SSH Ready');
        // Command to overwrite the file using heredoc
        const command = `cat << 'EOF' > /var/www/billing/src/services/billing/isolationService.ts\n${content}\nEOF\ncd /var/www/billing && npm run build && pm2 restart billing-app`;
        
        conn.exec(command, (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                console.log('App rebuilt and restarted with exit code: ' + code);
                conn.end();
            }).on('data', (data) => {
                console.log('STDOUT: ' + data);
            }).stderr.on('data', (data) => {
                console.log('STDERR: ' + data);
            });
        });
    }).connect(sshConfig);
}

deployPatch().catch(console.error);
