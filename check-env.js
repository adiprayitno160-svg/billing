const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkEnv() {
  try {
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    const result = await ssh.execCommand('cat .env', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    
  } catch (error) {
    console.error('Failed:', error);
  } finally {
    ssh.dispose();
  }
}
checkEnv();
