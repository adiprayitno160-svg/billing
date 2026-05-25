const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkLogs() {
  try {
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    const result = await ssh.execCommand('pm2 logs billing-app --lines 50 --nostream', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.log('Stderr:', result.stderr);

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    ssh.dispose();
  }
}
checkLogs();
