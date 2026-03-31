import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();
const config = {
    host: '192.168.239.154',
    username: 'adi',
    password: 'adi',
    port: 22,
    readyTimeout: 20000
};

const projectPath = '/var/www/billing';

async function deploy() {
    try {
        console.log('=============================================');
        console.log(`🚀 Starting Deployment to ${config.host}`);
        console.log('=============================================');

        console.log(`Connecting...`);
        await ssh.connect(config);
        console.log('✅ Connected to server');

        // Using git reset --hard to force update local files that conflict
        const commands = [
            {
                name: 'Git Update (Force)',
                cmd: `echo "${config.password}" | sudo -S bash -c "cd ${projectPath} && git fetch --all && git reset --hard origin/main"`
            },
            {
                name: 'NPM Install',
                cmd: `echo "${config.password}" | sudo -S bash -c "cd ${projectPath} && npm install --no-audit --no-fund --no-progress"`
            },
            {
                name: 'Build Project',
                cmd: `echo "${config.password}" | sudo -S bash -c "cd ${projectPath} && npm run build"`
            },
            {
                name: 'PM2 Restart',
                cmd: `echo "${config.password}" | sudo -S bash -c "cd ${projectPath} && pm2 restart billing-app --update-env"`
            }
        ];

        for (const task of commands) {
            console.log(`\n🔹 [${task.name}] Running...`);

            const result = await ssh.execCommand(task.cmd, {
                cwd: projectPath,
                onStdout: (chunk) => process.stdout.write(chunk.toString('utf8')),
                onStderr: (chunk) => process.stderr.write(chunk.toString('utf8'))
            });

            if (result.code !== 0) {
                console.error(`\n❌ [${task.name}] FAILED (Exit Code: ${result.code})`);
                ssh.dispose();
                process.exit(1);
            } else {
                console.log(`\n✅ [${task.name}] Success`);
            }
        }

        console.log('\n✨ Deployment Completed Successfully!');
        ssh.dispose();

    } catch (error) {
        console.error('\n❌ Deployment Script Error:', error);
        ssh.dispose();
        process.exit(1);
    }
}

deploy();
