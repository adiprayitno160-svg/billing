import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();
const config = {
    host: '192.168.239.154',
    username: 'adi',
    password: 'adi',
    port: 22,
    readyTimeout: 60000
};

const token = 'eyJhIjoiYjA1ODFmZDAwM2MxM2I2NTQ1NWI4ZGE3MzZkZWI4ZWMiLCJ0IjoiYzc3ZDE3ZGItOGE0ZS00Y2JkLWFhYjUtMTRjNTZhYjY5OTQwIiwicyI6Ik5UY3dZemcwTjJJdFlURXhPQzAwTURkbUxXSmpaVEl0TWpnNE0yWmtNV0l6TlRBeSJ9';

async function setupWithRetry(maxRetries = 10) {
    let connected = false;
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`Connecting to 192.168.239.154 (Attempt ${i + 1}/${maxRetries})...`);
            await ssh.connect(config);
            connected = true;
            console.log('✅ Connected.');
            break;
        } catch (e) {
            console.error(`❌ Attempt ${i + 1} failed:`, e.message);
            if (i < maxRetries - 1) {
                console.log('Waiting 5s before retry...');
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }

    if (!connected) {
        console.error('All connection attempts failed.');
        process.exit(1);
    }

    try {
        const commands = [
            {
                name: 'Setup GPG Keyring',
                cmd: `echo "${config.password}" | sudo -S mkdir -p --mode=0755 /usr/share/keyrings`
            },
            {
                name: 'Add Cloudflare GPG Key',
                cmd: `curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null`
            },
            {
                name: 'Add Repository',
                cmd: `echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list`
            },
            {
                name: 'Update APT',
                cmd: `echo "${config.password}" | sudo -S apt-get update`
            },
            {
                name: 'Install Cloudflared',
                cmd: `echo "${config.password}" | sudo -S apt-get install cloudflared -y`
            },
            {
                name: 'Remove Old Service',
                cmd: `echo "${config.password}" | sudo -S cloudflared service uninstall || true`
            },
            {
                name: 'Install Tunnel Service',
                cmd: `echo "${config.password}" | sudo -S cloudflared service install ${token}`
            },
            {
                name: 'Restart Service',
                cmd: `echo "${config.password}" | sudo -S systemctl enable cloudflared && echo "${config.password}" | sudo -S systemctl restart cloudflared`
            }
        ];

        for (const task of commands) {
            console.log(`\n🔹 [${task.name}] Running...`);
            // Add a timeout per command as well
            const result = await ssh.execCommand(task.cmd);
            if (result.stdout) console.log('STDOUT:', result.stdout);
            if (result.stderr) console.log('STDERR:', result.stderr);
            
            if (result.code !== 0 && !task.name.includes('Old Service')) {
                console.warn(`⚠️ [${task.name}] finished with exit code ${result.code}`);
            }
        }

        console.log('\n--- Final Connection Check ---');
        const check = await ssh.execCommand('ping -c 2 google.com && systemctl status cloudflared --no-pager');
        console.log(check.stdout || check.stderr);

        console.log('\n✨ Setup process finished.');
        ssh.dispose();
    } catch (e) {
        console.error('❌ SSH Execution Error:', e.message);
        ssh.dispose();
        process.exit(1);
    }
}

setupWithRetry();
