import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();
const config = {
    host: '192.168.239.154',
    username: 'adi',
    password: 'adi',
    port: 22,
    readyTimeout: 10000
};

async function test() {
    try {
        console.log('Connecting...');
        await ssh.connect(config);
        console.log('Connected.');
        
        console.log('Testing internet (8.8.8.8)...');
        const r1 = await ssh.execCommand('ping -c 3 8.8.8.8');
        console.log(r1.stdout || r1.stderr || 'No response to ping.');
        
        console.log('Checking DNS (github.com)...');
        const r2 = await ssh.execCommand('nslookup github.com || host github.com || ping -c 1 github.com');
        console.log(r2.stdout || r2.stderr || 'DNS lookup failed.');
        
        console.log('Resolv.conf:');
        const r3 = await ssh.execCommand('cat /etc/resolv.conf');
        console.log(r3.stdout);
        
        ssh.dispose();
    } catch (e) {
        console.log('Error:', e.message);
    }
}

test();
