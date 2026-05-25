const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
  try {
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });
    console.log('Connected!');

    const findResult = await ssh.execCommand('find /var/www/billing/dist -name "UnifiedNotificationService.js"');
    console.log('Found path:', findResult.stdout);

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    ssh.dispose();
  }
}

run();
