const { exec } = require('child_process');

const PROCESS_NAME = 'billing-app';

function execute(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                // Ignore specific errors
                if (stderr.includes('Process or Namespace not found')) {
                    resolve(null);
                    return;
                }
                resolve({ error, stderr });
                return;
            }
            resolve({ stdout: stdout.trim() });
        });
    });
}

async function manage() {
    console.log('🔄 PM2 Manager for Billing System');
    try {
        // Check if pm2 is installed
        const pm2Check = await execute('pm2 -v');
        if (pm2Check.error) {
            console.error('❌ PM2 is not installed or not in PATH.');
            console.log('   Run: npm install -g pm2');
            process.exit(1);
        }

        // Check if process exists
        console.log('🔍 Checking process status...');
        const listResult = await execute('pm2 jlist');
        let isRunning = false;

        if (listResult.stdout) {
            try {
                const processes = JSON.parse(listResult.stdout);
                const proc = processes.find(p => p.name === PROCESS_NAME);
                if (proc) {
                    isRunning = true;
                    console.log(`   Process found. Status: ${proc.pm2_env.status}`);
                }
            } catch (e) {
                console.error('   Error parsing PM2 list:', e.message);
            }
        }

        if (isRunning) {
            console.log('♻️  Restarting process...');
            const restartResult = await execute(`pm2 reload ${PROCESS_NAME} --update-env`);
            if (restartResult.error) {
                // Fallback to restart if reload fails
                console.log('   Reload failed, trying restart...');
                await execute(`pm2 restart ${PROCESS_NAME} --update-env`);
            }
            console.log('✅ Process restarted.');
        } else {
            console.log('🚀 Starting process...');
            // Ensure build exists
            await execute('npm run build');
            const startResult = await execute('pm2 start ecosystem.config.js --env production');
            if (startResult.error) {
                throw new Error(startResult.stderr || startResult.error.message);
            }
            console.log('✅ Process started.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

manage();
