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

    // Search inside the logs directory for Mbah Tini (129) or notifications (3336, 3337)
    const result = await ssh.execCommand('grep -rn "129" /var/www/billing/logs/ || true');
    console.log('Grep results for 129:');
    console.log(result.stdout);

    const result2 = await ssh.execCommand('grep -rn "3336\\|3337" /var/www/billing/logs/ || true');
    console.log('Grep results for 3336/3337:');
    console.log(result2.stdout);

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    ssh.dispose();
  }
}

run();
