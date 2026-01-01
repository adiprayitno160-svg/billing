const { execSync } = require('child_process');

function run(command) {
    try {
        return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
        return null;
    }
}

console.log('🔄 Checking PM2 Status...');

// Check if billing-app is running
const list = run('pm2 jlist');
let isRunning = false;

if (list) {
    try {
        const processes = JSON.parse(list);
        const app = processes.find(p => p.name === 'billing-app');
        if (app) {
            isRunning = true;
            console.log(`✅ App found (Status: ${app.pm2_env.status})`);
        }
    } catch (e) {
        console.warn('⚠️ Failed to parse PM2 list');
    }
}

try {
    if (isRunning) {
        console.log('♻️ Restarting billing-app...');
        execSync('pm2 restart billing-app --update-env', { stdio: 'inherit' });
    } else {
        console.log('🚀 Starting billing-app for the first time...');
        execSync('npm run pm2:start', { stdio: 'inherit' });
    }
    console.log('✅ PM2 process updated successfully.');
} catch (error) {
    console.error('❌ Error updating PM2 process:', error.message);
    process.exit(1);
}
