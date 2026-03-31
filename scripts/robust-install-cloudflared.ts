import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();
const config = {
    host: '192.168.239.154',
    username: 'adi',
    password: 'adi',
    port: 22,
    readyTimeout: 60000
};

// Use the token provided by the user
const token = 'eyJhIjoiYjA1ODFmZDAwM2MxM2I2NTQ1NWI4ZGE3MzZkZWI4ZWMiLCJ0IjoiYzc3ZDE3ZGItOGE0ZS00Y2JkLWFhYjUtMTRjNTZhYjY5OTQwIiwicyI6Ik5UY3dZemcwTjJJdFlURXhPQzAwTURkbUxXSmpaVEl0TWpnNE0yWmtNV0l6TlRBeSJ9';

async function runWithRetry(cmdName: string, command: string, maxRetries = 15, permissive = false) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`\n🔹 [${cmdName}] Attempt ${i + 1}/${maxRetries}...`);
            if (!ssh.isConnected()) {
                console.log('Connecting...');
                await ssh.connect(config);
            }
            const result = await ssh.execCommand(command);
            
            if (result.code === 0) {
                console.log(`✅ [${cmdName}] Success.`);
                return true;
            } else {
                const output = (result.stderr || result.stdout).substring(0, 500);
                console.error(`❌ [${cmdName}] Status ${result.code}:`, output);
                
                // Success conditions despite non-zero exit code
                if (output.includes('already installed') || 
                    output.includes('Success') || 
                    (permissive && result.code !== 0)) {
                    console.log(`✅ [${cmdName}] Treated as Success (Permissive/Already done).`);
                    return true;
                }
            }
        } catch (e) {
            console.error(`❌ [${cmdName}] Error:`, e.message);
            try { ssh.dispose(); } catch (err) {}
        }
        console.log('Waiting 3s before retry...');
        await new Promise(r => setTimeout(r, 3000));
    }
    return false;
}

async function main() {
    console.log('Starting Robust Cloudflare Setup...');
    
    const commands = [
        { 
            name: 'Aggressive Cleanup', 
            cmd: `echo "${config.password}" | sudo -S systemctl stop cloudflared || true; echo "${config.password}" | sudo -S cloudflared service uninstall || true; echo "${config.password}" | sudo -S rm -f /etc/systemd/system/cloudflared.service || true; echo "${config.password}" | sudo -S systemctl daemon-reload`,
            permissive: true 
        },
        { 
            name: 'Update APT', 
            cmd: `echo "${config.password}" | sudo -S apt-get update`,
            permissive: true 
        },
        { 
            name: 'Install Cloudflared', 
            cmd: `echo "${config.password}" | sudo -S apt-get install cloudflared -y` 
        },
        { 
            name: 'Install Tunnel Service', 
            cmd: `echo "${config.password}" | sudo -S cloudflared service install ${token}` 
        },
        { 
            name: 'Fix Protocol (Force HTTP2 if QUIC/UDP blocked)', 
            cmd: `echo "${config.password}" | sudo -S sed -i 's/tunnel run/tunnel --protocol http2 run/g' /etc/systemd/system/cloudflared.service || true` 
        },
        { 
            name: 'Start Service', 
            cmd: `echo "${config.password}" | sudo -S systemctl daemon-reload && echo "${config.password}" | sudo -S systemctl enable cloudflared && echo "${config.password}" | sudo -S systemctl restart cloudflared` 
        }
    ];

    for (const task of commands) {
        const success = await runWithRetry(task.name, task.cmd, 15, task.permissive);
        if (!success) {
            console.error(`\n🛑 Critical failure at [${task.name}].`);
            // We continue anyway to try and get logs at the end
        }
    }

    console.log('\n--- Final Verification & Logs ---');
    try {
        if (!ssh.isConnected()) await ssh.connect(config);
        
        console.log('\n[Service Status]');
        const status = await ssh.execCommand('systemctl status cloudflared --no-pager');
        console.log(status.stdout || status.stderr);
        
        console.log('\n[Recent Logs]');
        const logs = await ssh.execCommand('sudo journalctl -u cloudflared -n 20 --no-pager');
        console.log(logs.stdout || logs.stderr);
        
    } catch (e) {
        console.error('Failed to get final logs:', e.message);
    }
    
    ssh.dispose();
    console.log('\n✨ Done. Check Cloudflare Dashboard.');
}

main();
