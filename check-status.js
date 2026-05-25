const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run(cmd, cwd = '/var/www/billing') {
  console.log(`\n>>> ${cmd}`);
  const r = await ssh.execCommand(cmd, { cwd });
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.log('STDERR:', r.stderr);
  return r;
}

async function check() {
  try {
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected!\n');

    // Check PM2 status
    await run('pm2 list');

    // Check recent error logs
    console.log('\n=== Error Logs ===');
    await run('pm2 logs billing-app --lines 50 --nostream');

    // Test HTTP
    console.log('\n=== Test HTTP ===');
    await run('curl -s -o /dev/null -w "HTTP Status: %{http_code}" http://localhost:3002/');

  } catch (error) {
    console.error('FAILED:', error.message);
  } finally {
    ssh.dispose();
  }
}

check();
