import { Client } from 'ssh2';

async function testMikrotikSSH() {
    const config = {
        host: '192.168.30.1',
        port: 22, // Default SSH port
        username: 'adi',
        password: 'adi',
        readyTimeout: 5000 // 5 seconds timeout
    };

    console.log('🔍 Testing MikroTik SSH Connection...\n');
    console.log('Configuration:');
    console.log(`  Host: ${config.host}`);
    console.log(`  Port: ${config.port} (SSH)`);
    console.log(`  Username: ${config.username}`);
    console.log(`  Password: ${'*'.repeat(config.password.length)}`);
    console.log(`  Timeout: ${config.readyTimeout}ms\n`);

    const client = new Client();

    return new Promise<void>((resolve, reject) => {
        let connected = false;

        // Connection timeout
        const timeout = setTimeout(() => {
            if (!connected) {
                console.error('\n❌ Connection Timeout!');
                client.end();
                reject(new Error('Connection timeout after 5 seconds'));
            }
        }, config.readyTimeout);

        client.on('ready', () => {
            clearTimeout(timeout);
            connected = true;
            console.log('✅ SSH Connected successfully!\n');

            // Execute commands
            execCommand(client, '/system identity print');
            execCommand(client, '/system resource print');
            execCommand(client, '/ip address print');
            execCommand(client, '/ppp secret print count-only');
            execCommand(client, '/ppp active print count-only');
            
            // Close connection after commands
            setTimeout(() => {
                console.log('\n🔌 Closing SSH connection...');
                client.end();
                console.log('✅ Done.\n');
                resolve();
            }, 3000);
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            console.error('\n❌ SSH Connection Failed!');
            console.error('Error:', err.message);
            
            console.log('\n💡 Possible Issues:');
            console.log('  1. SSH service not enabled on MikroTik');
            console.log('  2. Wrong IP address, username, or password');
            console.log('  3. Firewall blocking SSH (port 22)');
            console.log('  4. Network connectivity issue');
            console.log('  5. Wrong credentials');
            
            console.log('\n💡 To enable SSH on MikroTik:');
            console.log('  /ip service enable ssh');
            console.log('  /ip service set ssh port=22');
            
            reject(err);
        });

        client.on('close', () => {
            console.log('🔌 SSH connection closed.');
        });

        console.log('📡 Connecting to MikroTik via SSH...');
        client.connect(config);
    });
}

function execCommand(client: Client, command: string) {
    return new Promise<void>((resolve) => {
        console.log(`\n📋 Executing: ${command}`);
        client.exec(command, (err, stream) => {
            if (err) {
                console.error('  ❌ Command failed:', err.message);
                resolve();
                return;
            }
            
            let output = '';
            
            stream.on('close', (code: any, signal: any) => {
                if (output.trim()) {
                    console.log('  Output:');
                    output.split('\n').forEach(line => {
                        if (line.trim()) console.log(`    ${line}`);
                    });
                }
                resolve();
            }).on('data', (data: any) => {
                output += data.toString();
            }).stderr.on('data', (data: any) => {
                console.error('  STDERR:', data.toString());
            });
        });
    });
}

testMikrotikSSH().catch(() => process.exit(1));
