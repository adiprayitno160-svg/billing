const { NodeSSH } = require('node-ssh');

const ssh = new NodeSSH();

async function restart() {
  try {
    console.log('Connecting to server...');
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected!');

    console.log('Restarting PM2 billing-app...');
    const result = await ssh.execCommand('pm2 reload billing-app || pm2 restart billing-app', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.log('Stderr:', result.stderr);

    console.log('Restart completed successfully!');
  } catch (error) {
    console.error('Restart failed:', error);
  } finally {
    ssh.dispose();
  }
}

restart();
