import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();
const config = {
    host: '192.168.239.154',
    username: 'adi',
    password: 'adi',
    port: 22,
    readyTimeout: 30000
};

const token = 'eyJhIjoiYjA1ODFmZDAwM2MxM2I2NTQ1NWI4ZGE3MzZkZWI4ZWMiLCJ0IjoiYzc3ZDE3ZGItOGE0ZS00Y2JkLWFhYjUtMTRjNTZhYjY5OTQwIiwicyI6Ik5UY3dZemcwTjJJdFlURXhPQzAwTURkbUxXSmpaVEl0TWpnNE0yWmtNV0l6TlRBeSJ9';

async function setup() {
    try {
        console.log('Connecting to 192.168.239.154...');
        await ssh.connect(config);
        console.log('✅ Connected.');

        const commands = [
            {
                name: 'Add Cloudflare GPG Key',
                cmd: `echo "${config.password}" | sudo -S mkdir -p --mode=0755 /usr/share/keyrings && curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null`
            },
            {
                name: 'Add Repository',
                cmd: `echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo -S tee /etc/apt/sources.list.d/cloudflared.list`
            },
            {
                name: 'Update & Install cloudflared',
                cmd: `echo "${config.password}" | sudo -S apt-get update && echo "${config.password}" | sudo -S apt-get install cloudflared -y`
            },
            {
                name: 'Cleanup old service (if any)',
                cmd: `echo "${config.password}" | sudo -S cloudflared service uninstall || true`
            },
            {
                name: 'Install Tunnel Service',
                cmd: `echo "${config.password}" | sudo -S cloudflared service install ${token}`
            },
            {
                name: 'Enable and Start Service',
                cmd: `echo "${config.password}" | sudo -S systemctl enable cloudflared && echo "${config.password}" | sudo -S systemctl start cloudflared`
            },
            {
                name: 'Verify Status',
                cmd: 'cloudflared --version && systemctl status cloudflared --no-pager'
            }
        ];

        for (const task of commands) {
            console.log(`\n🔹 [${task.name}] Running...`);
            const result = await ssh.execCommand(task.cmd);
            console.log(result.stdout || result.stderr);
            
            if (result.code !== 0 && !task.name.includes('Cleanup')) {
                console.warn(`⚠️ [${task.name}] finished with exit code ${result.code}`);
            }
        }

        console.log('\n✨ Cloudflare Tunnel Setup Completed via Repository!');
        ssh.dispose();
    } catch (e) {
        console.error('❌ SSH Error:', e.message);
    }
}

setup();
