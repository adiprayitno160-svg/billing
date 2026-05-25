const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkMysql() {
  try {
    await ssh.connect({
      host: '192.168.239.154',
      username: 'adi',
      password: 'adi'
    });

    const result = await ssh.execCommand('sudo systemctl status mysql || sudo systemctl status mariadb', { cwd: '/var/www/billing' });
    console.log(result.stdout);
    if (result.stderr) console.log('Stderr:', result.stderr);
    
  } catch (error) {
    console.error('Failed:', error);
  } finally {
    ssh.dispose();
  }
}
checkMysql();
