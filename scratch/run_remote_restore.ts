import { Client } from 'ssh2';
import fs from 'fs';

const sshConfig = {
    host: '192.168.239.154',
    port: 22,
    username: 'adi',
    password: 'adi'
};

async function executeRemote() {
    const conn = new Client();
    const scriptContent = fs.readFileSync('c:/laragon/www/billing/scratch/restore_yudi_mikrotik.ts', 'utf8');

    conn.on('ready', () => {
        console.log('SSH Ready');
        const command = `mkdir -p /var/www/billing/scratch && cat << 'EOF' > /var/www/billing/scratch/restore_yudi_mikrotik.ts\n${scriptContent}\nEOF\ncd /var/www/billing && npx ts-node scratch/restore_yudi_mikrotik.ts`;
        
        conn.exec(command, (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                console.log('Script executed with exit code: ' + code);
                conn.end();
            }).on('data', (data) => {
                console.log('STDOUT: ' + data);
            }).stderr.on('data', (data) => {
                console.log('STDERR: ' + data);
            });
        });
    }).connect(sshConfig);
}

executeRemote().catch(console.error);
