import { NodeSSH } from 'node-ssh';
import * as path from 'path';

const ssh = new NodeSSH();
const config = {
    host: '192.168.239.154',
    username: 'adi',
    password: 'adi',
    port: 22,
    readyTimeout: 20000
};

const token = 'eyJhIjoiYjA1ODFmZDAwM2MxM2I2NTQ1NWI4ZGE3MzZkZWI4ZWMiLCJ0IjoiYzc3ZDE3ZGItOGE0ZS00Y2JkLWFhYjUtMTRjNTZhYjY5OTQwIiwicyI6Ik5UY3dZemcwTjJJdFlURXhPQzAwTURkbUxXSmpaVEl0TWpnNE0yWmtNV0l6TlRBeSJ9';
const localDebPath = path.join('c:', 'laragon', 'www', 'billing', 'cloudflared.deb');

async function setup() {
    try {
        console.log('=============================================');
        console.log(`🚀 Setting up Cloudflare Tunnel on ${config.host}`);
        console.log('=============================================');

        console.log(`Connecting...`);
        await ssh.connect(config);
        console.log('✅ Connected to server');

        console.log(`\n🔹 [Uploading Cloudflared.deb]...`);
        await ssh.putFile(localDebPath, '/tmp/cloudflared.deb');
        console.log('✅ Uploaded to /tmp/cloudflared.deb');

        const commands = [
            {
                name: 'Install Cloudflared',
                cmd: `echo "${config.password}" | sudo -S dpkg -i /tmp/cloudflared.deb`
            },
            {
                name: 'Check Cloudflared Installation',
                cmd: 'cloudflared --version'
            },
            {
                name: 'Remove Existing Service (if any)',
                cmd: `echo "${config.password}" | sudo -S cloudflared service uninstall || true`
            },
            {
                name: 'Install Cloudflared Service',
                cmd: `echo "${config.password}" | sudo -S cloudflared service install ${token}`
            },
            {
                name: 'Enable and Start Service',
                cmd: `echo "${config.password}" | sudo -S systemctl enable cloudflared && echo "${config.password}" | sudo -S systemctl start cloudflared`
            },
            {
                name: 'Final Status Check',
                cmd: 'systemctl status cloudflared --no-pager'
            }
        ];

        for (const task of commands) {
            console.log(`\n🔹 [${task.name}] Running...`);

            const result = await ssh.execCommand(task.cmd, {
                onStdout: (chunk) => process.stdout.write(chunk.toString('utf8')),
                onStderr: (chunk) => process.stderr.write(chunk.toString('utf8'))
            });

            if (result.code !== 0 && !task.name.includes('Remove')) {
                console.error(`\n❌ [${task.name}] FAILED (Exit Code: ${result.code})`);
            } else {
                console.log(`\n✅ [${task.name}] Success/Finished`);
            }
        }

        console.log('\n✨ Cloudflare Tunnel Setup Completed!');
        ssh.dispose();

    } catch (error) {
        console.error('\n❌ Setup Script Error:', error);
        ssh.dispose();
        process.exit(1);
    }
}

setup();
