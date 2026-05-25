const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run(cmd, cwd = '/var/www/billing') {
  console.log(`\n>>> ${cmd}`);
  const r = await ssh.execCommand(cmd, { cwd });
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.log('STDERR:', r.stderr);
  return r;
}

async function forceSend() {
  try {
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected!\n');

    // 1. Check current queue status for Kelvin Niko
    console.log('=== Step 1: Current Kelvin Niko Queue Status ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT id, status, scheduled_for, retry_count, error_message, created_at FROM unified_notifications_queue WHERE customer_id = 39 ORDER BY created_at DESC LIMIT 5;" billing');

    // 2. Trigger queue process via API (this calls process-queue API)
    console.log('\n=== Step 2: Triggering queue processing via HTTP POST ===');
    await run('curl -X POST http://localhost:3002/api/notification/process-queue');

    // 3. Wait 5 seconds
    console.log('\n=== Waiting 5 seconds for processing ===');
    await new Promise(r => setTimeout(r, 5000));

    // 4. Check status again
    console.log('\n=== Step 4: Queue Status After Trigger ===');
    await run('mysql -u root -pBillingRoot123 -e "SELECT id, status, scheduled_for, retry_count, error_message, sent_at FROM unified_notifications_queue WHERE customer_id = 39 ORDER BY created_at DESC LIMIT 5;" billing');

    // 5. Check recent PM2 logs
    console.log('\n=== Step 5: Recent Logs ===');
    await run('pm2 logs billing-app --lines 30 --nostream');

  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

forceSend();
