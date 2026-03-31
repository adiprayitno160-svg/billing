import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();
const config = {
    host: '192.168.239.154',
    username: 'adi',
    password: 'adi',
    port: 22,
    readyTimeout: 20000
};

const token = 'eyJhIjoiYjA1ODFmZDAwM2MxM2I2NTQ1NWI4ZGE3MzZkZWI4ZWMiLCJ0IjoiYzc3ZDE3ZGItOGE0ZS00Y2JkLWFhYjUtMTRjNTZhYjY5OTQwIiwicyI6Ik5UY3dZemcwTjJJdFlURXhPQzAwTURkbUxXSmpaVEl0TWpnNE0yWmtNV0l6TlRBeSJ9';

async function setup() {
    try {
        console.log('Connecting to 192.168.239.154...');
        await ssh.connect(config);
        console.log('✅ Connected.');

        const commands = [
            {
                name: 'Install Cloudflared Package',
                cmd: `echo "${config.password}" | sudo -S dpkg -i /tmp/cloudflared.deb`
            },
            {
                name: 'Install Tunnel Service',
                cmd: `echo "${config.password}" | sudo -S cloudflared service install ${token}`
            },
            {
                name: 'Enable and Restart Service',
                cmd: `echo "${config.password}" | sudo -S systemctl enable cloudflared && echo "${config.password}" | sudo -S systemctl restart cloudflared`
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
            
            if (result.code !== 0 && !task.name.includes('Install Tunnel Service')) {
                console.warn(`⚠️ [${task.name}] finished with exit code ${result.code}`);
            }
        }

        console.log('\n✨ Setup process finished.');
        ssh.dispose();
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

setup();
