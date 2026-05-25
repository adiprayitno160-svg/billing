const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run(cmd, cwd = '/var/www/billing') {
  console.log(`\n>>> ${cmd}`);
  const r = await ssh.execCommand(cmd, { cwd });
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.log('STDERR:', r.stderr);
  return r;
}

async function deploy() {
  try {
    console.log('=== Connecting to server ===');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected!\n');

    // 1. Git pull
    console.log('=== Step 1: Pulling latest changes from GitHub ===');
    await run('git pull origin main');

    // 2. Build
    console.log('\n=== Step 2: Building application ===');
    await run('npm run build');

    // 3. Restart PM2 using the clean delete/start method
    console.log('\n=== Step 3: Restarting PM2 app ===');
    await run('pm2 delete billing-app || true');
    await run('pm2 start ecosystem.config.js --env production');

    // 4. Wait for startup
    console.log('\n=== Waiting 5 seconds for application startup ===');
    await new Promise(r => setTimeout(r, 5000));

    // 5. Verify status and logs
    console.log('\n=== Step 5: Verifying PM2 list ===');
    await run('pm2 list');

    console.log('\n=== Step 6: Verifying recent logs ===');
    await run('pm2 logs billing-app --lines 20 --nostream');

    console.log('\n=== Step 7: Verifying HTTP response ===');
    await run('curl -s -o /dev/null -w "HTTP Status: %{http_code}" http://localhost:3002/');

    console.log('\n=== DEPLOYMENT COMPLETED SUCCESSFULLY ===');
  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

deploy();
